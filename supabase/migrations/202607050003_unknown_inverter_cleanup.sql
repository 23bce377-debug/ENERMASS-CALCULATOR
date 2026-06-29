begin;

-- Replace placeholder Unknown inverter masters in preset item links with the
-- closest real active inverter. Prefer same inverter type and phase count when
-- available, then nearest kW, then lower selling price.
with unknown_inverters as (
  select id, capacity_kw, inverter_type, phases
  from public.eq_inverters
  where lower(coalesce(brand, '')) = 'unknown'
), replacements as (
  select u.id as old_inverter_id, inv.id as new_inverter_id
  from unknown_inverters u
  join lateral (
    select i.id
    from public.eq_inverters i
    where i.is_active = true
      and i.id <> u.id
      and lower(coalesce(i.brand, '')) <> 'unknown'
      and lower(coalesce(i.model, '')) <> 'inverter'
    order by
      case when i.inverter_type = u.inverter_type then 0 else 1 end,
      case when i.phases = u.phases then 0 else 1 end,
      abs(i.capacity_kw - u.capacity_kw) asc,
      i.org_id nulls first,
      i.selling_price asc,
      i.created_at asc
    limit 1
  ) inv on true
)
update public.system_items si
set inverter_id = r.new_inverter_id
from replacements r
where si.inverter_id = r.old_inverter_id;

update public.eq_inverters inv
set is_active = false,
    updated_at = now()
where lower(coalesce(inv.brand, '')) = 'unknown'
  and not exists (
    select 1
    from public.system_items si
    where si.inverter_id = inv.id
  );

commit;
