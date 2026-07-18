create extension if not exists "pgcrypto";

do $$ begin
  create type lead_status as enum (
    'New',
    'Contacted',
    'Audit Running',
    'Proposal Sent',
    'Closed Won',
    'Closed Lost'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type audit_request_status as enum ('Submitted', 'In Review', 'Analyzed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  company_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  business_type text,
  team_size text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id),
  name text not null,
  email text not null,
  company text not null,
  website text,
  business_type text not null,
  team_size text not null,
  average_project_value numeric check (average_project_value is null or average_project_value >= 0),
  hourly_rate numeric check (hourly_rate is null or hourly_rate > 0),
  pain_point text not null,
  consent_to_contact boolean not null default false,
  status lead_status not null default 'New',
  created_at timestamptz not null default now()
);

create table if not exists public.lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_status lead_status,
  to_status lead_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id),
  company_id uuid references public.companies(id),
  client_name text not null,
  project_value numeric check (project_value is null or project_value >= 0),
  hourly_rate numeric not null check (hourly_rate > 0),
  sow_text text not null,
  message_export_text text not null,
  suspected_scope_creep_notes text,
  status audit_request_status not null default 'Submitted',
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  company_id uuid references public.companies(id),
  lead_id uuid references public.leads(id),
  audit_request_id uuid references public.audit_requests(id),
  client_name text not null,
  project_name text not null,
  hourly_rate numeric not null check (hourly_rate > 0),
  project_value numeric check (project_value is null or project_value >= 0),
  sow_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source text not null check (source in ('Slack', 'Email', 'Zoom', 'Asana', 'Jira', 'Other')),
  sender text,
  message_text text not null,
  message_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.scope_analyses (
  id uuid primary key default gen_random_uuid(),
  client_message_id uuid not null references public.client_messages(id) on delete cascade,
  classification text not null check (
    classification in ('In Scope', 'Possibly In Scope', 'Out of Scope', 'Needs Human Review')
  ),
  confidence_score numeric not null check (confidence_score >= 0 and confidence_score <= 1),
  reasoning text not null,
  relevant_sow_sections jsonb not null default '[]'::jsonb,
  request_type text not null check (
    request_type in ('New Deliverable', 'Revision', 'Support', 'Strategy', 'Design', 'Engineering', 'Admin', 'Other')
  ),
  estimated_hours numeric not null default 0 check (estimated_hours >= 0),
  estimated_revenue numeric not null default 0 check (estimated_revenue >= 0),
  suggested_change_order text not null,
  internal_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  markdown text not null,
  total_revenue_leakage numeric not null default 0 check (total_revenue_leakage >= 0),
  analyzed_messages_count integer not null default 0 check (analyzed_messages_count >= 0),
  out_of_scope_count integer not null default 0 check (out_of_scope_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sales_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (
    template_type in (
      'Cold Email',
      'LinkedIn DM',
      'Discovery Call Script',
      'Audit Reveal Call Script',
      'Proposal Template',
      'Follow-up Email',
      'Objection Handling'
    )
  ),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies(name);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_company_id_idx on public.leads(company_id);
create index if not exists lead_status_history_lead_id_idx on public.lead_status_history(lead_id);
create index if not exists audit_requests_lead_id_idx on public.audit_requests(lead_id);
create index if not exists audit_requests_company_id_idx on public.audit_requests(company_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_company_id_idx on public.projects(company_id);
create index if not exists projects_lead_id_idx on public.projects(lead_id);
create index if not exists client_messages_project_id_idx on public.client_messages(project_id);
create index if not exists scope_analyses_client_message_id_idx on public.scope_analyses(client_message_id);
create index if not exists reports_project_id_idx on public.reports(project_id);
