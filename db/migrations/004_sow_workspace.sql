ALTER TABLE sow_versions DROP CONSTRAINT sow_versions_source_type_check;
ALTER TABLE sow_versions
  ADD CONSTRAINT sow_versions_source_type_check
  CHECK (source_type IN ('Pasted Text', 'TXT', 'DOCX', 'PDF', 'Imported JSON', 'Generated')),
  ADD COLUMN source_filename text,
  ADD COLUMN media_type text,
  ADD COLUMN byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  ADD COLUMN storage_path text,
  ADD COLUMN extraction_status text NOT NULL DEFAULT 'Succeeded'
    CHECK (extraction_status IN ('Succeeded', 'Needs Manual Text', 'Failed')),
  ADD COLUMN extraction_warning text;

ALTER TABLE scope_boundary_maps
  ADD COLUMN approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN approved_at timestamptz;

ALTER TABLE projects
  ADD COLUMN active_sow_version_id uuid,
  ADD COLUMN active_boundary_map_id uuid;

ALTER TABLE projects
  ADD CONSTRAINT projects_active_sow_version_fk
    FOREIGN KEY (organization_id, active_sow_version_id) REFERENCES sow_versions(organization_id, id),
  ADD CONSTRAINT projects_active_boundary_map_fk
    FOREIGN KEY (organization_id, active_boundary_map_id) REFERENCES scope_boundary_maps(organization_id, id);

CREATE TABLE sow_risk_reviews (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sow_version_id uuid NOT NULL REFERENCES sow_versions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft', 'Reviewed')),
  summary text NOT NULL,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_character_count integer CHECK (input_character_count IS NULL OR input_character_count >= 0),
  output_character_count integer CHECK (output_character_count IS NULL OR output_character_count >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE sow_risk_items (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_review_id uuid NOT NULL REFERENCES sow_risk_reviews(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('High', 'Medium', 'Low')),
  category text NOT NULL,
  description text NOT NULL,
  recommendation text NOT NULL,
  evidence text NOT NULL,
  ordinal integer NOT NULL DEFAULT 0 CHECK (ordinal >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

ALTER TABLE sow_risk_reviews
  ADD CONSTRAINT sow_risk_reviews_project_org_fk
    FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT sow_risk_reviews_version_org_fk
    FOREIGN KEY (organization_id, sow_version_id) REFERENCES sow_versions(organization_id, id) ON DELETE CASCADE;

ALTER TABLE sow_risk_items
  ADD CONSTRAINT sow_risk_items_review_org_fk
    FOREIGN KEY (organization_id, risk_review_id) REFERENCES sow_risk_reviews(organization_id, id) ON DELETE CASCADE;

ALTER TABLE analysis_jobs
  ADD COLUMN sow_version_id uuid REFERENCES sow_versions(id) ON DELETE SET NULL,
  ADD COLUMN boundary_map_id uuid REFERENCES scope_boundary_maps(id) ON DELETE SET NULL,
  ADD COLUMN latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  ADD COLUMN input_character_count integer CHECK (input_character_count IS NULL OR input_character_count >= 0),
  ADD COLUMN output_character_count integer CHECK (output_character_count IS NULL OR output_character_count >= 0);

ALTER TABLE analysis_jobs
  ADD CONSTRAINT analysis_jobs_sow_version_org_fk
    FOREIGN KEY (organization_id, sow_version_id) REFERENCES sow_versions(organization_id, id),
  ADD CONSTRAINT analysis_jobs_boundary_map_org_fk
    FOREIGN KEY (organization_id, boundary_map_id) REFERENCES scope_boundary_maps(organization_id, id);

CREATE INDEX sow_documents_project_idx ON sow_documents(organization_id, project_id, updated_at DESC);
CREATE INDEX sow_versions_document_idx ON sow_versions(organization_id, sow_document_id, version_number DESC);
CREATE INDEX boundary_maps_project_idx ON scope_boundary_maps(organization_id, project_id, updated_at DESC);
CREATE INDEX sow_risk_reviews_version_idx ON sow_risk_reviews(organization_id, sow_version_id, created_at DESC);

UPDATE projects p
SET active_sow_version_id = d.current_version_id
FROM sow_documents d
WHERE d.project_id = p.id AND d.organization_id = p.organization_id AND d.status = 'Active';
