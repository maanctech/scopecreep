-- Postgres does not index a foreign key column just because it is a foreign key.
-- 69 of them had no supporting index, so deleting a parent row took a lock and
-- scanned the whole child table to find what to cascade or null out.
--
-- Columns recording which user did something (created_by, actor_user_id,
-- reviewed_by, approved_by, changed_by, generated_by, requested_by) are
-- deliberately left unindexed. They are ON DELETE SET NULL against a table whose
-- rows are effectively never deleted, and nothing queries by them, so an index
-- would cost write throughput on every insert and buy nothing. That is a decision,
-- not an oversight.

CREATE INDEX analysis_jobs_project_idx ON analysis_jobs(project_id);
CREATE INDEX analysis_jobs_boundary_map_idx ON analysis_jobs(boundary_map_id);
CREATE INDEX analysis_jobs_sow_version_idx ON analysis_jobs(sow_version_id);

CREATE INDEX billing_events_project_idx ON billing_events(project_id);
CREATE INDEX billing_events_finding_idx ON billing_events(scope_finding_id);

CREATE INDEX communication_attachments_message_idx ON communication_attachments(message_id);
CREATE INDEX communication_sources_project_idx ON communication_sources(project_id);
CREATE INDEX communication_threads_project_idx ON communication_threads(project_id);
CREATE INDEX client_messages_thread_idx ON client_messages(thread_id);

CREATE INDEX ingestion_jobs_project_idx ON ingestion_jobs(project_id);
CREATE INDEX ingestion_jobs_connection_idx ON ingestion_jobs(connection_id);

CREATE INDEX lead_status_history_lead_idx ON lead_status_history(lead_id);
CREATE INDEX leads_company_idx ON leads(company_id);
CREATE INDEX audit_requests_company_idx ON audit_requests(company_id);
CREATE INDEX audit_requests_lead_idx ON audit_requests(lead_id);

CREATE INDEX oauth_requests_connection_idx ON oauth_authorization_requests(connection_id);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens(user_id);
CREATE INDEX user_sessions_user_idx ON user_sessions(user_id);

CREATE INDEX projects_company_idx ON projects(company_id);
CREATE INDEX projects_lead_idx ON projects(lead_id);
CREATE INDEX projects_audit_request_idx ON projects(audit_request_id);

CREATE INDEX reports_project_idx ON reports(project_id);
CREATE INDEX reports_current_version_idx ON reports(current_version_id);
CREATE INDEX report_versions_sow_version_idx ON report_versions(sow_version_id);

CREATE INDEX scope_findings_project_idx ON scope_findings(project_id);
CREATE INDEX scope_findings_analysis_job_idx ON scope_findings(analysis_job_id);
CREATE INDEX scope_boundary_items_map_idx ON scope_boundary_items(boundary_map_id);
CREATE INDEX scope_boundary_items_source_section_idx ON scope_boundary_items(source_section_id);
CREATE INDEX scope_boundary_maps_sow_version_idx ON scope_boundary_maps(sow_version_id);

CREATE INDEX sow_documents_current_version_idx ON sow_documents(current_version_id);
CREATE INDEX sow_risk_items_review_idx ON sow_risk_items(risk_review_id);
CREATE INDEX sow_risk_reviews_project_idx ON sow_risk_reviews(project_id);

-- The organization-wide reads sort by creation time across every project, which
-- none of the existing per-project indexes can serve.
CREATE INDEX scope_findings_org_created_idx ON scope_findings(organization_id, created_at DESC);
CREATE INDEX client_messages_org_created_idx ON client_messages(organization_id, created_at DESC);
