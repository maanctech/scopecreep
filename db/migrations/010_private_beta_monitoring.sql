ALTER TABLE analysis_jobs
  ADD COLUMN trigger_source text NOT NULL DEFAULT 'Manual'
    CHECK (trigger_source IN ('Manual', 'Automation'));

CREATE TABLE project_automation_settings (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Paused'
    CHECK (status IN ('Active', 'Paused', 'Needs Attention')),
  sync_interval_minutes integer NOT NULL DEFAULT 15
    CHECK (sync_interval_minutes BETWEEN 5 AND 1440),
  next_run_at timestamptz,
  last_started_at timestamptz,
  last_succeeded_at timestamptz,
  last_error text,
  require_approved_boundary boolean NOT NULL DEFAULT true,
  enabled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_id),
  UNIQUE (organization_id, id),
  CONSTRAINT project_automation_project_org_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT project_automation_enabler_org_fk
    FOREIGN KEY (organization_id, enabled_by_user_id)
    REFERENCES organization_memberships(organization_id, user_id)
);

CREATE INDEX project_automation_due_idx
  ON project_automation_settings(next_run_at, organization_id)
  WHERE status = 'Active';

CREATE TABLE automation_runs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Running', 'Succeeded', 'Failed', 'Cancelled')),
  lease_owner text NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  scheduled_for timestamptz NOT NULL,
  connections_attempted integer NOT NULL DEFAULT 0 CHECK (connections_attempted >= 0),
  messages_inserted integer NOT NULL DEFAULT 0 CHECK (messages_inserted >= 0),
  jobs_queued integer NOT NULL DEFAULT 0 CHECK (jobs_queued >= 0),
  findings_created integer NOT NULL DEFAULT 0 CHECK (findings_created >= 0),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, scheduled_for),
  CONSTRAINT automation_runs_project_org_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX automation_runs_lease_idx
  ON automation_runs(status, lease_expires_at)
  WHERE status = 'Running';

CREATE TABLE professional_notifications (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'Finding Ready', 'Analysis Failed', 'Evidence Changed',
    'Connector Failed', 'Automation Paused'
  )),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES scope_findings(id) ON DELETE CASCADE,
  analysis_job_id uuid REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES communication_connections(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text NOT NULL,
  digest_eligible boolean NOT NULL DEFAULT true,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CONSTRAINT professional_notifications_member_org_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE,
  CONSTRAINT professional_notifications_project_org_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT professional_notifications_finding_org_fk
    FOREIGN KEY (organization_id, finding_id)
    REFERENCES scope_findings(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT professional_notifications_analysis_job_org_fk
    FOREIGN KEY (organization_id, analysis_job_id)
    REFERENCES analysis_jobs(organization_id, id) ON DELETE CASCADE,
  CONSTRAINT professional_notifications_connection_org_fk
    FOREIGN KEY (organization_id, connection_id)
    REFERENCES communication_connections(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX professional_notifications_unread_idx
  ON professional_notifications(organization_id, user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_digest_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT notification_preferences_member_org_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE
);

CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Sending', 'Succeeded', 'Failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  provider_response text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, digest_date),
  UNIQUE (organization_id, id),
  CONSTRAINT notification_deliveries_member_org_fk
    FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE
);

ALTER TABLE client_messages
  ADD COLUMN evidence_changed_at timestamptz;

ALTER TABLE scope_findings
  ADD COLUMN source_evidence_stale_at timestamptz;
