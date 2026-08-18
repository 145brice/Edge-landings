create extension if not exists pgcrypto;

create table if not exists service_catalog (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  description text not null default '', complexity text not null check (complexity in ('simple','standard','complex')),
  suggested_min_cents integer not null check (suggested_min_cents >= 0),
  suggested_max_cents integer not null check (suggested_max_cents >= suggested_min_cents),
  actual_price_cents integer not null check (actual_price_cents >= 0), price_id text,
  estimated_delivery_days integer not null check (estimated_delivery_days > 0),
  baseline_metric text not null default 'small_business_site_usd', keywords text[] not null default '{}', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table service_catalog add column if not exists baseline_metric text not null default 'small_business_site_usd';
create table if not exists market_baselines (
  id uuid primary key default gen_random_uuid(), source_name text not null, source_url text not null,
  metric text not null, low_cents integer not null, high_cents integer not null,
  collected_at timestamptz not null, unique(source_url, metric)
);
create table if not exists estimate_events (
  id uuid primary key default gen_random_uuid(), service_id uuid references service_catalog(id), request_text text not null,
  requested_service text, classification text not null, suggested_min_cents integer, suggested_max_cents integer,
  quoted_price_cents integer, confidence numeric(4,3) not null, manual_review boolean not null, created_at timestamptz not null default now()
);
create table if not exists completed_jobs (
  id uuid primary key default gen_random_uuid(), external_event_id text unique not null, service_id uuid references service_catalog(id), request_text text not null,
  classification text not null, quoted_price_cents integer, final_price_cents integer not null,
  estimated_delivery_days integer, actual_delivery_days integer, outcome text not null, completed_at timestamptz not null
);
alter table completed_jobs add column if not exists external_event_id text;
create unique index if not exists completed_jobs_external_event_id_idx on completed_jobs(external_event_id) where external_event_id is not null;
alter table service_catalog enable row level security;
alter table market_baselines enable row level security;
alter table estimate_events enable row level security;
alter table completed_jobs enable row level security;

insert into service_catalog (slug,name,description,complexity,suggested_min_cents,suggested_max_cents,actual_price_cents,estimated_delivery_days,keywords)
values
  ('basic','Basic','Professionally designed website with secure hosting, mobile-friendly pages, contact forms, basic SEO, and three monthly content updates.','simple',9900,9900,9900,3,array['landing page','brochure','maintenance','small business','basic']),
  ('growth','Growth','Everything in Basic with ten monthly content updates and priority support.','standard',19900,19900,19900,3,array['landing page','brochure','maintenance','small business','growth','priority support'])
on conflict (slug) do update set name=excluded.name, description=excluded.description, complexity=excluded.complexity, suggested_min_cents=excluded.suggested_min_cents, suggested_max_cents=excluded.suggested_max_cents, actual_price_cents=excluded.actual_price_cents, estimated_delivery_days=excluded.estimated_delivery_days, keywords=excluded.keywords, updated_at=now();
update service_catalog set active=false, updated_at=now() where slug='website-care';
