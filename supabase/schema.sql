-- ==========================================================================
-- TeleSales Command Center  —  Supabase schema
-- Supabase Dashboard -> SQL Editor -> paste -> Run
-- ==========================================================================

create table if not exists public.leads (
  id            bigserial primary key,
  row_key       text unique,
  lead_date     date,
  name          text,
  contact       text,
  occupation    text,
  campaign      text,
  age           text,
  class         text,
  agent         text,
  parent_type   text,
  product_sugg  text,
  outcome       text,
  objection     text,
  short_code    text,
  stage         text,
  inserted_at   timestamptz default now()
);

create table if not exists public.orders (
  id             bigserial primary key,
  row_key        text unique,
  order_date     date,
  name           text,
  contact        text,
  address        text,
  district       text,
  sub_district   text,
  total_amount   numeric,
  shipping_charge numeric,
  discount       numeric,
  net_revenue    numeric,
  invoice_id     text,
  agent          text,     -- Order Collector
  product        text,     -- Product Name-1
  product_price  numeric,
  profession     text,
  class          text,
  age            text,
  inserted_at    timestamptz default now()
);

create index if not exists idx_leads_date  on public.leads(lead_date);
create index if not exists idx_leads_agent on public.leads(agent);
create index if not exists idx_orders_date on public.orders(order_date);
create index if not exists idx_orders_dist on public.orders(district);

-- Row Level Security: anon key sudhu READ korte parbe, write only service_role.
alter table public.leads  enable row level security;
alter table public.orders enable row level security;

drop policy if exists "public read leads"  on public.leads;
drop policy if exists "public read orders" on public.orders;
create policy "public read leads"  on public.leads  for select using (true);
create policy "public read orders" on public.orders for select using (true);
-- (service_role RLS bypass kore, tai write policy lagbe na)
