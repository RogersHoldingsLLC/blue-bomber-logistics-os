create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null check (status in ('prospect', 'customer')),
  city text,
  state text,
  segment text,
  current_opportunity text,
  smart_notes text default '',
  qualifying_questions jsonb not null default '{}'::jsonb,
  sales_lead text not null default 'Louie',
  operations_lead text not null default 'Brian',
  primary_contact_id uuid,
  last_contact text,
  last_activity text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  state text,
  equipment text,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  last_contact text,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  carrier_id uuid references carriers(id) on delete cascade,
  entity_id uuid,
  entity_type text not null default 'prospect' check (entity_type in ('prospect', 'customer', 'carrier')),
  title text not null,
  due text,
  priority text not null default 'normal' check (priority in ('critical', 'high', 'normal', 'low')),
  status text not null default 'open' check (status in ('open', 'done')),
  owner text not null,
  created_by text not null default 'System',
  source_company text not null,
  source_note text not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (entity_type in ('prospect', 'customer') and company_id is not null) or
    (entity_type = 'carrier' and carrier_id is not null)
  )
);

create table if not exists timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  body text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
