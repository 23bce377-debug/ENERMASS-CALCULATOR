begin;

create table if not exists public.master_hidden_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  entity text not null,
  global_id uuid not null,
  hidden_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint master_hidden_items_entity_check check (
    entity in ('panels', 'inverters', 'batteries', 'structures', 'accessories', 'pricing')
  ),
  constraint master_hidden_items_unique unique (org_id, entity, global_id)
);

alter table public.master_hidden_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'master_hidden_items'
      and policyname = 'master_hidden_items_org'
  ) then
    create policy "master_hidden_items_org"
      on public.master_hidden_items
      for all
      using (org_id = public.auth_org_id())
      with check (org_id = public.auth_org_id());
  end if;
end $$;

alter table public.eq_panels
  add column if not exists source_global_id uuid references public.eq_panels(id) on delete set null;

alter table public.eq_inverters
  add column if not exists source_global_id uuid references public.eq_inverters(id) on delete set null;

alter table public.eq_batteries
  add column if not exists source_global_id uuid references public.eq_batteries(id) on delete set null;

alter table public.eq_mounting_structures
  add column if not exists source_global_id uuid references public.eq_mounting_structures(id) on delete set null;

alter table public.bom_template_items
  add column if not exists source_global_id uuid references public.bom_template_items(id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists is_custom boolean not null default false,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

alter table public.eq_panels drop constraint if exists uq_panel;
alter table public.eq_inverters drop constraint if exists uq_inverter;
alter table public.eq_batteries drop constraint if exists uq_battery;

create unique index if not exists uq_eq_panels_org_brand_model_wattage
  on public.eq_panels (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(brand), lower(model), wattage_w)
  where source_global_id is null;

create unique index if not exists uq_eq_panels_org_source_override
  on public.eq_panels (org_id, source_global_id)
  where org_id is not null and source_global_id is not null;

create unique index if not exists uq_eq_inverters_org_brand_model_capacity_type
  on public.eq_inverters (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(brand), lower(model), capacity_kw, inverter_type)
  where source_global_id is null;

create unique index if not exists uq_eq_inverters_org_source_override
  on public.eq_inverters (org_id, source_global_id)
  where org_id is not null and source_global_id is not null;

create unique index if not exists uq_eq_batteries_org_brand_model_capacity
  on public.eq_batteries (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(brand), lower(model), capacity_kwh)
  where source_global_id is null;

create unique index if not exists uq_eq_batteries_org_source_override
  on public.eq_batteries (org_id, source_global_id)
  where org_id is not null and source_global_id is not null;

create unique index if not exists uq_eq_structures_org_source_override
  on public.eq_mounting_structures (org_id, source_global_id)
  where org_id is not null and source_global_id is not null;

create unique index if not exists uq_bom_template_items_org_source_override
  on public.bom_template_items (org_id, source_global_id)
  where org_id is not null and source_global_id is not null;

commit;
