alter table public.quotes
  add column if not exists equipment_json jsonb;

comment on column public.quotes.equipment_json is
  'Calculator equipment selection snapshot with panel/inverter/battery ids and mix quantities. Display columns keep human-readable names for PDF output.';
