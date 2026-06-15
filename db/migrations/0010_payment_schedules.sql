-- Migration: 0010_payment_schedules.sql

CREATE TABLE public.payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) NOT NULL,
  milestone_name text NOT NULL,
  trigger_event text NOT NULL,  -- "order_confirmed", "site_delivery", "installation", "commissioning"
  percent numeric NOT NULL,
  amount numeric NOT NULL,     -- computed: quote_total * percent/100
  due_date date,
  paid_at timestamp,
  payment_reference text,
  created_at timestamp DEFAULT now()
);
