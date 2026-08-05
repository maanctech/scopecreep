CREATE TABLE audit_intake_tokens (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_intake_tokens_lead_org_fk
    FOREIGN KEY (organization_id, lead_id) REFERENCES leads(organization_id, id)
);

CREATE INDEX audit_intake_tokens_active_idx
  ON audit_intake_tokens(organization_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX audit_intake_tokens_one_active_per_lead_idx
  ON audit_intake_tokens(organization_id, lead_id)
  WHERE consumed_at IS NULL;
