CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 120),
  is_system_admin boolean NOT NULL DEFAULT false,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('Owner', 'Admin', 'Reviewer', 'Read Only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE INDEX user_sessions_active_idx ON user_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE TABLE companies (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text,
  business_type text,
  team_size text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX companies_org_name_idx ON companies(organization_id, lower(name));

CREATE TABLE leads (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  website text,
  business_type text NOT NULL,
  team_size text NOT NULL,
  average_project_value_cents bigint CHECK (average_project_value_cents IS NULL OR average_project_value_cents >= 0),
  hourly_rate_cents integer CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  pain_point text NOT NULL,
  consent_to_contact boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('New', 'Contacted', 'Audit Running', 'Proposal Sent', 'Closed Won', 'Closed Lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX leads_org_created_idx ON leads(organization_id, created_at DESC);

CREATE TABLE lead_status_history (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  project_value_cents bigint CHECK (project_value_cents IS NULL OR project_value_cents >= 0),
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents > 0),
  sow_text text NOT NULL,
  message_export_text text NOT NULL,
  suspected_scope_creep_notes text,
  status text NOT NULL CHECK (status IN ('Submitted', 'In Review', 'Analyzed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  audit_request_id uuid REFERENCES audit_requests(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  project_name text NOT NULL,
  hourly_rate_cents integer NOT NULL CHECK (hourly_rate_cents > 0),
  project_value_cents bigint CHECK (project_value_cents IS NULL OR project_value_cents >= 0),
  legacy_sow_text text NOT NULL DEFAULT '',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (organization_id, id)
);

CREATE INDEX projects_org_created_idx ON projects(organization_id, created_at DESC);

CREATE TABLE sow_documents (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Superseded', 'Archived')),
  current_version_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE sow_versions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sow_document_id uuid NOT NULL REFERENCES sow_documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  source_type text NOT NULL DEFAULT 'Pasted Text' CHECK (source_type IN ('Pasted Text', 'Imported JSON', 'Generated')),
  content text NOT NULL,
  content_sha256 text NOT NULL,
  change_note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sow_document_id, version_number),
  UNIQUE (organization_id, id)
);

ALTER TABLE sow_documents
  ADD CONSTRAINT sow_documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES sow_versions(id) ON DELETE SET NULL;

CREATE TABLE sow_sections (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sow_version_id uuid NOT NULL REFERENCES sow_versions(id) ON DELETE CASCADE,
  heading text,
  body text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sow_version_id, ordinal),
  UNIQUE (organization_id, id)
);

CREATE TABLE scope_boundary_maps (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sow_version_id uuid REFERENCES sow_versions(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE scope_boundary_items (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  boundary_map_id uuid NOT NULL REFERENCES scope_boundary_maps(id) ON DELETE CASCADE,
  boundary_type text NOT NULL CHECK (boundary_type IN ('Included', 'Excluded', 'Ambiguous', 'Assumption', 'Limit')),
  category text NOT NULL,
  description text NOT NULL,
  evidence text,
  source_section_id uuid REFERENCES sow_sections(id) ON DELETE SET NULL,
  ordinal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE communication_connections (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('Manual', 'Webhook', 'IMAP', 'Slack', 'Google', 'Microsoft', 'Other')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Not Connected' CHECK (status IN ('Not Connected', 'Connected', 'Paused', 'Error')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE encrypted_secrets (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES communication_connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  ciphertext text NOT NULL,
  initialization_vector text NOT NULL,
  auth_tag text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connection_id, name)
);

CREATE TABLE communication_sources (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES communication_connections(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  external_id text,
  source_type text NOT NULL,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, connection_id, external_id)
);

CREATE TABLE communication_threads (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES communication_sources(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  external_id text,
  subject text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_message_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, source_id, external_id)
);

CREATE TABLE client_messages (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id uuid REFERENCES communication_sources(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES communication_threads(id) ON DELETE SET NULL,
  external_id text,
  source text NOT NULL,
  sender text,
  sender_email text,
  message_text text NOT NULL,
  message_date timestamptz,
  content_sha256 text,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, source_id, external_id)
);

CREATE INDEX client_messages_project_date_idx ON client_messages(organization_id, project_id, message_date DESC);

CREATE TABLE communication_attachments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES client_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  media_type text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  storage_path text,
  content_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE ingestion_jobs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES communication_connections(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('Queued', 'Running', 'Succeeded', 'Failed', 'Cancelled')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error_message text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE analysis_jobs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_message_id uuid REFERENCES client_messages(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('Queued', 'Running', 'Succeeded', 'Failed', 'Cancelled')),
  input_sha256 text NOT NULL,
  raw_output text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE scope_findings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_message_id uuid NOT NULL REFERENCES client_messages(id) ON DELETE CASCADE,
  analysis_job_id uuid REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  classification text NOT NULL CHECK (classification IN ('In Scope', 'Possibly In Scope', 'Out of Scope', 'Needs Human Review')),
  confidence_score numeric(5,4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  reasoning text NOT NULL,
  relevant_sow_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_type text NOT NULL CHECK (request_type IN ('New Deliverable', 'Revision', 'Support', 'Strategy', 'Design', 'Engineering', 'Admin', 'Other')),
  estimated_hours numeric(10,2) NOT NULL CHECK (estimated_hours >= 0),
  estimated_revenue_cents bigint NOT NULL CHECK (estimated_revenue_cents >= 0),
  suggested_change_order text NOT NULL,
  billing_decision text NOT NULL CHECK (billing_decision IN ('Undecided', 'Bill Separately', 'Include In Retainer', 'Absorb Courtesy', 'Discuss With Client', 'Reject Finding')),
  workflow_status text NOT NULL CHECK (workflow_status IN ('New', 'Needs Review', 'Decided', 'Discussing', 'Invoiced', 'Paid', 'Closed')),
  approved_hours numeric(10,2) CHECK (approved_hours IS NULL OR approved_hours >= 0),
  approved_amount_cents bigint CHECK (approved_amount_cents IS NULL OR approved_amount_cents >= 0),
  client_facing_explanation text NOT NULL,
  internal_note text,
  reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_label text,
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, client_message_id)
);

CREATE INDEX scope_findings_review_idx ON scope_findings(organization_id, workflow_status, billing_decision);

CREATE TABLE scope_finding_history (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scope_finding_id uuid NOT NULL REFERENCES scope_findings(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_finding_id, version)
);

CREATE TABLE billing_events (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope_finding_id uuid NOT NULL REFERENCES scope_findings(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  amount_cents bigint,
  previous_amount_cents bigint,
  new_amount_cents bigint,
  previous_status text,
  new_status text,
  previous_decision text,
  new_decision text,
  note text,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX billing_events_org_created_idx ON billing_events(organization_id, created_at DESC);

CREATE TABLE reports (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  current_version_id uuid,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE report_versions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  markdown text NOT NULL,
  total_revenue_leakage_cents bigint NOT NULL CHECK (total_revenue_leakage_cents >= 0),
  analyzed_messages_count integer NOT NULL CHECK (analyzed_messages_count >= 0),
  out_of_scope_count integer NOT NULL CHECK (out_of_scope_count >= 0),
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, version_number),
  UNIQUE (organization_id, id)
);

ALTER TABLE reports
  ADD CONSTRAINT reports_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES report_versions(id) ON DELETE SET NULL;

CREATE TABLE sales_templates (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE sync_checkpoints (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES communication_connections(id) ON DELETE CASCADE,
  checkpoint_key text NOT NULL,
  checkpoint_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, connection_id, checkpoint_key)
);

CREATE TABLE organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_org_created_idx ON audit_logs(organization_id, created_at DESC);

CREATE TABLE backup_records (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Running', 'Succeeded', 'Failed')),
  storage_path text,
  checksum_sha256 text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  error_message text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, id)
);

CREATE OR REPLACE FUNCTION forbid_billing_event_changes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'billing_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_events_no_update
BEFORE UPDATE OR DELETE ON billing_events
FOR EACH ROW EXECUTE FUNCTION forbid_billing_event_changes();

CREATE OR REPLACE FUNCTION forbid_audit_log_changes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_changes();
