ALTER TABLE report_versions
  ADD COLUMN report_type text NOT NULL DEFAULT 'Internal Scope Audit',
  ADD COLUMN sow_version_id uuid REFERENCES sow_versions(id) ON DELETE SET NULL,
  ADD COLUMN source_finding_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN analysis_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN content_sha256 text,
  ADD COLUMN csv_content text NOT NULL DEFAULT '',
  ADD COLUMN csv_sha256 text;

ALTER TABLE report_versions
  ADD CONSTRAINT report_versions_type_check CHECK (
    report_type IN (
      'Internal Scope Audit',
      'Finding Summary',
      'Revenue Leakage Report',
      'Client Discussion Brief',
      'Change Order Draft',
      'Invoice Support Summary'
    )
  ),
  ADD CONSTRAINT report_versions_sow_org_fk
    FOREIGN KEY (organization_id, sow_version_id) REFERENCES sow_versions(organization_id, id);

CREATE INDEX report_versions_project_created_idx
  ON report_versions(organization_id, report_id, created_at DESC);

ALTER TABLE backup_records
  ADD COLUMN backup_version integer NOT NULL DEFAULT 1 CHECK (backup_version > 0),
  ADD COLUMN manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN includes_database boolean NOT NULL DEFAULT false,
  ADD COLUMN includes_documents boolean NOT NULL DEFAULT false,
  ADD COLUMN includes_encrypted_secrets boolean NOT NULL DEFAULT false;

CREATE INDEX backup_records_org_created_idx
  ON backup_records(organization_id, created_at DESC);
