ALTER TABLE communication_connections
  DROP CONSTRAINT communication_connections_provider_check;
ALTER TABLE communication_connections
  ADD CONSTRAINT communication_connections_provider_check
  CHECK (provider IN ('Manual', 'Webhook', 'IMAP', 'Slack', 'Google', 'Microsoft', 'Transcript', 'Other'));

ALTER TABLE client_messages
  ADD COLUMN deleted_at timestamptz;

CREATE TABLE oauth_authorization_requests (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES communication_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('Google', 'Microsoft')),
  state_sha256 text NOT NULL UNIQUE,
  verifier_ciphertext text NOT NULL,
  verifier_initialization_vector text NOT NULL,
  verifier_auth_tag text NOT NULL,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

ALTER TABLE oauth_authorization_requests
  ADD CONSTRAINT oauth_requests_connection_org_fk
  FOREIGN KEY (organization_id, connection_id)
  REFERENCES communication_connections(organization_id, id) ON DELETE CASCADE;

CREATE INDEX oauth_requests_lookup_idx
  ON oauth_authorization_requests(state_sha256, expires_at)
  WHERE used_at IS NULL;
