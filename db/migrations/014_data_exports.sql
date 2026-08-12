-- The tenant-scoped replacement for the installation backup that was retired
-- from customer reach. One organization's rows, produced by ordinary queries
-- under that organization's tenant scope, with no shell command anywhere.

CREATE TABLE data_exports (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('Queued', 'Running', 'Succeeded', 'Failed')),
  requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
  storage_path text,
  byte_size bigint,
  content_sha256 text,
  table_count integer,
  row_count integer,
  withheld_tables text[] NOT NULL DEFAULT '{}',
  error_message text,
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE INDEX data_exports_organization_idx ON data_exports(organization_id, created_at DESC);

ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_exports FORCE ROW LEVEL SECURITY;

CREATE POLICY data_exports_tenant_isolation ON data_exports
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));
