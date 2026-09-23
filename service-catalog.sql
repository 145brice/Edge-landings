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
create table if not exists client_projects (
  id uuid primary key default gen_random_uuid(),
  portal_token_hash text unique not null,
  plan_slug text not null check (plan_slug in ('basic','growth')),
  status text not null default 'intake_received' check (status in ('intake_received','building','draft_ready','changes_requested','approved','active','paused')),
  client_name text not null, business_name text not null, email text not null, phone text not null,
  intake jsonb not null default '{}'::jsonb,
  site_structure jsonb not null default '[]'::jsonb,
  sections jsonb not null default '[]'::jsonb,
  preview_url text,
  approved_at timestamptz, paid_at timestamptz,
  stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists client_projects_email_idx on client_projects(lower(email));
create table if not exists client_change_requests (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references client_projects(id) on delete cascade,
  section_key text not null, section_label text not null, request_type text not null,
  details text not null, status text not null default 'requested' check (status in ('requested','reviewing','scheduled','complete','declined')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists client_change_requests_project_idx on client_change_requests(project_id,created_at desc);
create table if not exists client_project_messages (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references client_projects(id) on delete cascade,
  sender text not null check (sender in ('client','owner','system')),
  category text not null check (category in ('new_build','update')),
  body text not null, section_key text,
  created_at timestamptz not null default now()
);
create index if not exists client_project_messages_project_idx on client_project_messages(project_id,created_at);
alter table completed_jobs add column if not exists external_event_id text;
create unique index if not exists completed_jobs_external_event_id_idx on completed_jobs(external_event_id) where external_event_id is not null;
alter table service_catalog enable row level security;
alter table market_baselines enable row level security;
alter table estimate_events enable row level security;
alter table completed_jobs enable row level security;
alter table client_projects enable row level security;
alter table client_change_requests enable row level security;
alter table client_project_messages enable row level security;

insert into service_catalog (slug,name,description,complexity,suggested_min_cents,suggested_max_cents,actual_price_cents,estimated_delivery_days,keywords)
values
  ('basic','Basic','Beta plan: one page with up to six sections, two pre-launch revision rounds, secure hosting, mobile-friendly pages, contact forms, basic SEO, and three monthly content updates.','simple',4900,4900,4900,3,array['landing page','brochure','maintenance','small business','basic']),
  ('growth','Growth','Beta plan: up to five pages with all Basic essentials, two pre-launch revision rounds, ten monthly content updates, priority support, ongoing SEO, Google Business Profile optimization, Google Analytics and Search Console setup, and monthly performance reporting.','standard',9900,9900,9900,3,array['landing page','brochure','maintenance','small business','growth','priority support','ongoing seo','google business profile','analytics','search console'])
on conflict (slug) do update set name=excluded.name, description=excluded.description, complexity=excluded.complexity, suggested_min_cents=excluded.suggested_min_cents, suggested_max_cents=excluded.suggested_max_cents, actual_price_cents=excluded.actual_price_cents, estimated_delivery_days=excluded.estimated_delivery_days, keywords=excluded.keywords, updated_at=now();
update service_catalog set active=false, updated_at=now() where slug='website-care';
