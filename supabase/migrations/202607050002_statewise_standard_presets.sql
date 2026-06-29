begin;

alter table public.systems
  add column if not exists state_id uuid references public.state_rules(id) on delete set null;

create index if not exists idx_systems_state_id on public.systems(state_id);

-- Replace placeholder panel masters in preset item links with a real active panel
-- of the same wattage, then hide unreferenced Unknown PANEL rows from pickers.
with unknown_panels as (
  select id, wattage_w
  from public.eq_panels
  where lower(coalesce(brand, '')) = 'unknown'
), replacements as (
  select u.id as old_panel_id, p.id as new_panel_id
  from unknown_panels u
  join lateral (
    select id
    from public.eq_panels p
    where p.is_active = true
      and p.id <> u.id
      and p.wattage_w = u.wattage_w
      and lower(coalesce(p.brand, '')) <> 'unknown'
      and lower(coalesce(p.model, '')) <> 'panel'
    order by p.org_id nulls first, p.selling_price asc, p.created_at asc
    limit 1
  ) p on true
)
update public.system_items si
set panel_id = r.new_panel_id
from replacements r
where si.panel_id = r.old_panel_id;

update public.eq_panels ep
set is_active = false,
    updated_at = now()
where lower(coalesce(ep.brand, '')) = 'unknown'
  and not exists (
    select 1
    from public.system_items si
    where si.panel_id = ep.id
  );

-- Existing Rajasthan presets are the source templates and should be explicitly
-- scoped to Rajasthan instead of appearing as global presets.
with rajasthan as (
  select id from public.state_rules where state_code = 'RJ' limit 1
)
update public.systems s
set state_id = rajasthan.id,
    name = case
      when s.name = 'Rajasthan 3KW' then 'Rajasthan 3 kW Standard'
      when s.name = 'Rajasthan 5KW' then 'Rajasthan 5 kW Standard'
      when s.name = 'Rajasthan 6KW' then 'Rajasthan 6 kW Standard'
      else s.name
    end,
    updated_at = now()
from rajasthan
where s.name in ('Rajasthan 3KW', 'Rajasthan 5KW', 'Rajasthan 6KW');

-- Seed three quote-ready standard presets for every active state by cloning the
-- complete Rajasthan 3/5/6 kW BOMs. This keeps pricing/components editable via
-- the normal preset editor while making state selection automatic.
with template_systems as (
  select 3::numeric as size_kw, s.id as template_id, s.panel_wattage_w, s.panel_qty, s.target_margin_pct
  from public.systems s
  where s.name in ('Rajasthan 3 kW Standard', 'Rajasthan 3KW')
  order by s.updated_at desc
  limit 1
), template_5 as (
  select 5::numeric as size_kw, s.id as template_id, s.panel_wattage_w, s.panel_qty, s.target_margin_pct
  from public.systems s
  where s.name in ('Rajasthan 5 kW Standard', 'Rajasthan 5KW')
  order by s.updated_at desc
  limit 1
), template_6 as (
  select 6::numeric as size_kw, s.id as template_id, s.panel_wattage_w, s.panel_qty, s.target_margin_pct
  from public.systems s
  where s.name in ('Rajasthan 6 kW Standard', 'Rajasthan 6KW')
  order by s.updated_at desc
  limit 1
), templates as (
  select * from template_systems
  union all select * from template_5
  union all select * from template_6
), state_sizes as (
  select
    sr.id as state_id,
    sr.state_name,
    sr.state_code,
    t.size_kw,
    t.template_id,
    t.panel_wattage_w,
    t.panel_qty,
    t.target_margin_pct
  from public.state_rules sr
  cross join templates t
  where sr.is_active = true
), inserted as (
  insert into public.systems (
    org_id,
    name,
    category,
    capacity_kw,
    panel_wattage_w,
    panel_qty,
    target_margin_pct,
    is_active,
    is_custom,
    state_id
  )
  select
    null,
    ss.state_name || ' ' || trim(to_char(ss.size_kw, 'FM999999990.##')) || ' kW Standard',
    'on_grid'::public.system_category,
    ss.size_kw,
    ss.panel_wattage_w,
    ss.panel_qty,
    ss.target_margin_pct,
    true,
    false,
    ss.state_id
  from state_sizes ss
  where not exists (
    select 1
    from public.systems existing
    where existing.is_active = true
      and existing.category = 'on_grid'
      and existing.state_id = ss.state_id
      and abs(existing.capacity_kw - ss.size_kw) < 0.01
  )
  returning id, state_id, capacity_kw
)
insert into public.system_items (
  system_id,
  section,
  description,
  unit,
  default_qty,
  sort_order,
  is_included_by_default,
  is_mandatory,
  remarks,
  panel_id,
  inverter_id,
  battery_id,
  structure_id,
  solar_meter_id,
  net_meter_id,
  la_id,
  bom_item_id,
  comm_device_id,
  structure_component_id
)
select
  i.id,
  si.section,
  si.description,
  si.unit,
  si.default_qty,
  si.sort_order,
  si.is_included_by_default,
  si.is_mandatory,
  si.remarks,
  si.panel_id,
  si.inverter_id,
  si.battery_id,
  si.structure_id,
  si.solar_meter_id,
  si.net_meter_id,
  si.la_id,
  si.bom_item_id,
  si.comm_device_id,
  si.structure_component_id
from inserted i
join state_sizes ss
  on ss.state_id = i.state_id
 and abs(ss.size_kw - i.capacity_kw) < 0.01
join public.system_items si
  on si.system_id = ss.template_id
where not exists (
  select 1
  from public.system_items existing
  where existing.system_id = i.id
);

-- Keep the older many-to-many availability map in sync for existing code paths:
-- a state_id preset is visible only for that one state.
delete from public.system_state_availability ssa
using public.systems s
where ssa.system_id = s.id
  and s.state_id is not null
  and ssa.state_id <> s.state_id;

insert into public.system_state_availability (system_id, state_id)
select s.id, s.state_id
from public.systems s
where s.state_id is not null
on conflict (system_id, state_id) do nothing;

commit;
