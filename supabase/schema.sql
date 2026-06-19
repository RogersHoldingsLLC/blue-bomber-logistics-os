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
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled', 'overdue')),
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

alter table tasks drop constraint if exists tasks_status_check;
update tasks set status = 'completed' where status = 'done';
alter table tasks
  add constraint tasks_status_check
  check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled', 'overdue'));

create table if not exists timeline (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  body text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);


create table if not exists communication_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  carrier_id uuid references carriers(id) on delete cascade,
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('prospect', 'customer', 'carrier')),
  direction text not null check (direction in ('sent', 'received')),
  subject text not null,
  contact_or_email text,
  occurred_at timestamptz not null default now(),
  summary text,
  follow_up_needed boolean not null default false,
  follow_up_action_text text,
  follow_up_due_date text,
  source text not null check (source in ('Outlook', 'Gmail Operations')),
  created_by text not null default 'System',
  created_at timestamptz not null default now(),
  check (
    (entity_type in ('prospect', 'customer') and company_id is not null and carrier_id is null) or
    (entity_type = 'carrier' and carrier_id is not null and company_id is null)
  )
);

create index if not exists communication_logs_company_id_idx on communication_logs(company_id);
create index if not exists communication_logs_carrier_id_idx on communication_logs(carrier_id);
create index if not exists communication_logs_occurred_at_idx on communication_logs(occurred_at desc);


create table if not exists account_files (
  id text primary key,
  company_id uuid references companies(id) on delete cascade,
  carrier_id uuid references carriers(id) on delete cascade,
  account_id uuid not null,
  account_type text not null check (account_type in ('company', 'carrier')),
  provider text not null check (provider in ('google_drive', 'supabase_storage')),
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  category text not null default 'Misc',
  google_drive_file_id text,
  google_drive_folder_id text,
  google_drive_web_view_link text,
  google_drive_web_content_link text,
  supabase_storage_path text,
  uploaded_by text not null default 'System',
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (account_type = 'company' and company_id is not null and carrier_id is null) or
    (account_type = 'carrier' and carrier_id is not null and company_id is null)
  )
);

create index if not exists account_files_company_id_idx on account_files(company_id);
create index if not exists account_files_carrier_id_idx on account_files(carrier_id);
create index if not exists account_files_uploaded_at_idx on account_files(uploaded_at desc);
