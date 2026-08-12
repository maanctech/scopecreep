-- Every policy already wrapped has_system_access() in a scalar sub-select so the
-- planner evaluates it once per query. tenant_id() was left bare, so it was
-- re-evaluated for every row examined, on every table, for every statement the
-- application runs. The rule each policy expresses is unchanged; only how often
-- the tenant lookup runs changes.

DROP POLICY analysis_jobs_tenant_isolation ON analysis_jobs;
CREATE POLICY analysis_jobs_tenant_isolation ON analysis_jobs
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY audit_requests_tenant_isolation ON audit_requests;
CREATE POLICY audit_requests_tenant_isolation ON audit_requests
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY backup_records_tenant_isolation ON backup_records;
CREATE POLICY backup_records_tenant_isolation ON backup_records
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY billing_events_tenant_isolation ON billing_events;
CREATE POLICY billing_events_tenant_isolation ON billing_events
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY client_messages_tenant_isolation ON client_messages;
CREATE POLICY client_messages_tenant_isolation ON client_messages
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY communication_attachments_tenant_isolation ON communication_attachments;
CREATE POLICY communication_attachments_tenant_isolation ON communication_attachments
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY communication_connections_tenant_isolation ON communication_connections;
CREATE POLICY communication_connections_tenant_isolation ON communication_connections
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY communication_sources_tenant_isolation ON communication_sources;
CREATE POLICY communication_sources_tenant_isolation ON communication_sources
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY communication_threads_tenant_isolation ON communication_threads;
CREATE POLICY communication_threads_tenant_isolation ON communication_threads
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY companies_tenant_isolation ON companies;
CREATE POLICY companies_tenant_isolation ON companies
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY encrypted_secrets_tenant_isolation ON encrypted_secrets;
CREATE POLICY encrypted_secrets_tenant_isolation ON encrypted_secrets
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY ingestion_jobs_tenant_isolation ON ingestion_jobs;
CREATE POLICY ingestion_jobs_tenant_isolation ON ingestion_jobs
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY lead_status_history_tenant_isolation ON lead_status_history;
CREATE POLICY lead_status_history_tenant_isolation ON lead_status_history
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY leads_tenant_isolation ON leads;
CREATE POLICY leads_tenant_isolation ON leads
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY oauth_authorization_requests_tenant_isolation ON oauth_authorization_requests;
CREATE POLICY oauth_authorization_requests_tenant_isolation ON oauth_authorization_requests
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY organization_memberships_tenant_isolation ON organization_memberships;
CREATE POLICY organization_memberships_tenant_isolation ON organization_memberships
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY organization_settings_tenant_isolation ON organization_settings;
CREATE POLICY organization_settings_tenant_isolation ON organization_settings
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY projects_tenant_isolation ON projects;
CREATE POLICY projects_tenant_isolation ON projects
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY report_versions_tenant_isolation ON report_versions;
CREATE POLICY report_versions_tenant_isolation ON report_versions
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY reports_tenant_isolation ON reports;
CREATE POLICY reports_tenant_isolation ON reports
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sales_templates_tenant_isolation ON sales_templates;
CREATE POLICY sales_templates_tenant_isolation ON sales_templates
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY scope_boundary_items_tenant_isolation ON scope_boundary_items;
CREATE POLICY scope_boundary_items_tenant_isolation ON scope_boundary_items
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY scope_boundary_maps_tenant_isolation ON scope_boundary_maps;
CREATE POLICY scope_boundary_maps_tenant_isolation ON scope_boundary_maps
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY scope_finding_history_tenant_isolation ON scope_finding_history;
CREATE POLICY scope_finding_history_tenant_isolation ON scope_finding_history
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY scope_findings_tenant_isolation ON scope_findings;
CREATE POLICY scope_findings_tenant_isolation ON scope_findings
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sow_documents_tenant_isolation ON sow_documents;
CREATE POLICY sow_documents_tenant_isolation ON sow_documents
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sow_risk_items_tenant_isolation ON sow_risk_items;
CREATE POLICY sow_risk_items_tenant_isolation ON sow_risk_items
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sow_risk_reviews_tenant_isolation ON sow_risk_reviews;
CREATE POLICY sow_risk_reviews_tenant_isolation ON sow_risk_reviews
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sow_sections_tenant_isolation ON sow_sections;
CREATE POLICY sow_sections_tenant_isolation ON sow_sections
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sow_versions_tenant_isolation ON sow_versions;
CREATE POLICY sow_versions_tenant_isolation ON sow_versions
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY sync_checkpoints_tenant_isolation ON sync_checkpoints;
CREATE POLICY sync_checkpoints_tenant_isolation ON sync_checkpoints
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY user_sessions_tenant_isolation ON user_sessions;
CREATE POLICY user_sessions_tenant_isolation ON user_sessions
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries;
CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  USING ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR organization_id = (SELECT tenant_id()));

DROP POLICY organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
  USING ((SELECT has_system_access()) OR id = (SELECT tenant_id()))
  WITH CHECK ((SELECT has_system_access()) OR id = (SELECT tenant_id()));

DROP POLICY users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING ((SELECT has_system_access()) OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = users.id AND m.organization_id = (SELECT tenant_id())))
  WITH CHECK ((SELECT has_system_access()) OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.user_id = users.id AND m.organization_id = (SELECT tenant_id())));
