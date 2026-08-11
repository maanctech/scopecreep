-- Row-level security. Until now organization scoping lived only in WHERE
-- clauses, so a single missed predicate returned another tenant's rows.
-- Policies read a transaction-scoped setting applied by lib/db/client.ts;
-- when it is absent the comparison yields NULL and the row is withheld, so
-- a caller that forgets its context reads nothing rather than everything.

CREATE FUNCTION tenant_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;

CREATE FUNCTION has_system_access() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT current_setting('app.system_access', true) = 'on' $$;

CREATE INDEX lead_status_history_organization_id_idx ON lead_status_history(organization_id);
CREATE INDEX scope_finding_history_organization_id_idx ON scope_finding_history(organization_id);
CREATE INDEX user_sessions_organization_id_idx ON user_sessions(organization_id);

ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY analysis_jobs_tenant_isolation ON analysis_jobs
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE audit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_requests_tenant_isolation ON audit_requests
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE backup_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_records FORCE ROW LEVEL SECURITY;
CREATE POLICY backup_records_tenant_isolation ON backup_records
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_events_tenant_isolation ON billing_events
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY client_messages_tenant_isolation ON client_messages
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE communication_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_attachments_tenant_isolation ON communication_attachments
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE communication_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_connections_tenant_isolation ON communication_connections
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE communication_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_sources_tenant_isolation ON communication_sources
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_threads FORCE ROW LEVEL SECURITY;
CREATE POLICY communication_threads_tenant_isolation ON communication_threads
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY companies_tenant_isolation ON companies
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_secrets FORCE ROW LEVEL SECURITY;
CREATE POLICY encrypted_secrets_tenant_isolation ON encrypted_secrets
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY ingestion_jobs_tenant_isolation ON ingestion_jobs
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_history FORCE ROW LEVEL SECURITY;
CREATE POLICY lead_status_history_tenant_isolation ON lead_status_history
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;
CREATE POLICY leads_tenant_isolation ON leads
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE oauth_authorization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY oauth_authorization_requests_tenant_isolation ON oauth_authorization_requests
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_memberships_tenant_isolation ON organization_memberships
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_settings_tenant_isolation ON organization_settings
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY projects_tenant_isolation ON projects
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY report_versions_tenant_isolation ON report_versions
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;
CREATE POLICY reports_tenant_isolation ON reports
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sales_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY sales_templates_tenant_isolation ON sales_templates
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE scope_boundary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_boundary_items FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_boundary_items_tenant_isolation ON scope_boundary_items
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE scope_boundary_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_boundary_maps FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_boundary_maps_tenant_isolation ON scope_boundary_maps
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE scope_finding_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_finding_history FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_finding_history_tenant_isolation ON scope_finding_history
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE scope_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_findings FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_findings_tenant_isolation ON scope_findings
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sow_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY sow_documents_tenant_isolation ON sow_documents
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sow_risk_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_risk_items FORCE ROW LEVEL SECURITY;
CREATE POLICY sow_risk_items_tenant_isolation ON sow_risk_items
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sow_risk_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_risk_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY sow_risk_reviews_tenant_isolation ON sow_risk_reviews
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sow_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_sections FORCE ROW LEVEL SECURITY;
CREATE POLICY sow_sections_tenant_isolation ON sow_sections
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sow_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY sow_versions_tenant_isolation ON sow_versions
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints FORCE ROW LEVEL SECURITY;
CREATE POLICY sync_checkpoints_tenant_isolation ON sync_checkpoints
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY user_sessions_tenant_isolation ON user_sessions
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  USING ((SELECT has_system_access()) OR organization_id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR organization_id = tenant_id());

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING ((SELECT has_system_access()) OR id = tenant_id())
  WITH CHECK ((SELECT has_system_access()) OR id = tenant_id());

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;
CREATE POLICY password_reset_tokens_tenant_isolation ON password_reset_tokens
  USING ((SELECT has_system_access()) OR false)
  WITH CHECK ((SELECT has_system_access()) OR false);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_isolation ON users
  USING ((SELECT has_system_access()) OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = users.id AND m.organization_id = tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = users.id AND m.organization_id = tenant_id()));
