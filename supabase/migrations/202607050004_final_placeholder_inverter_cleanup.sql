begin;

-- Final guard pass for placeholder inverter masters. Earlier migrations may
-- have cloned presets before cleanup, or org-specific imports may have added
-- active rows with brand/model placeholders.
with placeholder_inverters as (
  select id, capacity_kw, inverter_type, phases
  from public.eq_inverters
  where lower(trim(coalesce(brand, ''))) in ('unknown', 'unknown brand')
     or lower(trim(coalesce(model, ''))) in ('unknown', 'unknown model', 'inverter')
), replacements as (
  select p.id as old_inverter_id, replacement.id as new_inverter_id
  from placeholder_inverters p
  join lateral (
    select i.id
    from public.eq_inverters i
    where i.is_active = true
      and i.id <> p.id
      and lower(trim(coalesce(i.brand, ''))) not in ('unknown', 'unknown brand')
      and lower(trim(coalesce(i.model, ''))) not in ('unknown', 'unknown model', 'inverter')
    order by
      case when i.inverter_type = p.inverter_type then 0 else 1 end,
      case when i.phases = p.phases then 0 else 1 end,
      abs(coalesce(i.capacity_kw, 0) - coalesce(p.capacity_kw, 0)) asc,
      case when i.org_id is null then 0 else 1 end,
      i.selling_price asc,
      i.created_at asc
    limit 1
  ) replacement on true
)
update public.system_items si
set inverter_id = r.new_inverter_id,
    description = case
      when upper(trim(coalesce(si.description, ''))) in ('INVERTER', 'UNKNOWN', 'UNKNOWN INVERTER')
        then 'INVERTER'
      else si.description
    end
from replacements r
where si.inverter_id = r.old_inverter_id;

update public.eq_inverters inv
set is_active = false,
    updated_at = now()
where lower(trim(coalesce(inv.brand, ''))) in ('unknown', 'unknown brand')
   or lower(trim(coalesce(inv.model, ''))) in ('unknown', 'unknown model', 'inverter');

commit;
