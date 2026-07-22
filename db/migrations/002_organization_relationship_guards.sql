ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_membership_org_fk
  FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;

ALTER TABLE leads ADD CONSTRAINT leads_company_org_fk
  FOREIGN KEY (organization_id, company_id) REFERENCES companies(organization_id, id);
ALTER TABLE lead_status_history ADD CONSTRAINT lead_history_lead_org_fk
  FOREIGN KEY (organization_id, lead_id) REFERENCES leads(organization_id, id) ON DELETE CASCADE;

ALTER TABLE audit_requests ADD CONSTRAINT audit_requests_lead_org_fk
  FOREIGN KEY (organization_id, lead_id) REFERENCES leads(organization_id, id);
ALTER TABLE audit_requests ADD CONSTRAINT audit_requests_company_org_fk
  FOREIGN KEY (organization_id, company_id) REFERENCES companies(organization_id, id);

ALTER TABLE projects ADD CONSTRAINT projects_company_org_fk
  FOREIGN KEY (organization_id, company_id) REFERENCES companies(organization_id, id);
ALTER TABLE projects ADD CONSTRAINT projects_lead_org_fk
  FOREIGN KEY (organization_id, lead_id) REFERENCES leads(organization_id, id);
ALTER TABLE projects ADD CONSTRAINT projects_audit_request_org_fk
  FOREIGN KEY (organization_id, audit_request_id) REFERENCES audit_requests(organization_id, id);

ALTER TABLE sow_documents ADD CONSTRAINT sow_documents_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE sow_documents ADD CONSTRAINT sow_documents_current_version_org_fk
  FOREIGN KEY (organization_id, current_version_id) REFERENCES sow_versions(organization_id, id);
ALTER TABLE sow_versions ADD CONSTRAINT sow_versions_document_org_fk
  FOREIGN KEY (organization_id, sow_document_id) REFERENCES sow_documents(organization_id, id) ON DELETE CASCADE;
ALTER TABLE sow_sections ADD CONSTRAINT sow_sections_version_org_fk
  FOREIGN KEY (organization_id, sow_version_id) REFERENCES sow_versions(organization_id, id) ON DELETE CASCADE;

ALTER TABLE scope_boundary_maps ADD CONSTRAINT boundary_maps_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE scope_boundary_maps ADD CONSTRAINT boundary_maps_sow_version_org_fk
  FOREIGN KEY (organization_id, sow_version_id) REFERENCES sow_versions(organization_id, id);
ALTER TABLE scope_boundary_items ADD CONSTRAINT boundary_items_map_org_fk
  FOREIGN KEY (organization_id, boundary_map_id) REFERENCES scope_boundary_maps(organization_id, id) ON DELETE CASCADE;
ALTER TABLE scope_boundary_items ADD CONSTRAINT boundary_items_section_org_fk
  FOREIGN KEY (organization_id, source_section_id) REFERENCES sow_sections(organization_id, id);

ALTER TABLE encrypted_secrets ADD CONSTRAINT encrypted_secrets_connection_org_fk
  FOREIGN KEY (organization_id, connection_id) REFERENCES communication_connections(organization_id, id) ON DELETE CASCADE;
ALTER TABLE communication_sources ADD CONSTRAINT communication_sources_connection_org_fk
  FOREIGN KEY (organization_id, connection_id) REFERENCES communication_connections(organization_id, id);
ALTER TABLE communication_sources ADD CONSTRAINT communication_sources_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id);
ALTER TABLE communication_threads ADD CONSTRAINT communication_threads_source_org_fk
  FOREIGN KEY (organization_id, source_id) REFERENCES communication_sources(organization_id, id);
ALTER TABLE communication_threads ADD CONSTRAINT communication_threads_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id);
ALTER TABLE client_messages ADD CONSTRAINT client_messages_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE client_messages ADD CONSTRAINT client_messages_source_org_fk
  FOREIGN KEY (organization_id, source_id) REFERENCES communication_sources(organization_id, id);
ALTER TABLE client_messages ADD CONSTRAINT client_messages_thread_org_fk
  FOREIGN KEY (organization_id, thread_id) REFERENCES communication_threads(organization_id, id);
ALTER TABLE communication_attachments ADD CONSTRAINT attachments_message_org_fk
  FOREIGN KEY (organization_id, message_id) REFERENCES client_messages(organization_id, id) ON DELETE CASCADE;

ALTER TABLE ingestion_jobs ADD CONSTRAINT ingestion_jobs_connection_org_fk
  FOREIGN KEY (organization_id, connection_id) REFERENCES communication_connections(organization_id, id);
ALTER TABLE ingestion_jobs ADD CONSTRAINT ingestion_jobs_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id);
ALTER TABLE analysis_jobs ADD CONSTRAINT analysis_jobs_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE analysis_jobs ADD CONSTRAINT analysis_jobs_message_org_fk
  FOREIGN KEY (organization_id, client_message_id) REFERENCES client_messages(organization_id, id) ON DELETE CASCADE;

ALTER TABLE scope_findings ADD CONSTRAINT scope_findings_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE scope_findings ADD CONSTRAINT scope_findings_message_org_fk
  FOREIGN KEY (organization_id, client_message_id) REFERENCES client_messages(organization_id, id) ON DELETE CASCADE;
ALTER TABLE scope_findings ADD CONSTRAINT scope_findings_job_org_fk
  FOREIGN KEY (organization_id, analysis_job_id) REFERENCES analysis_jobs(organization_id, id);
ALTER TABLE scope_finding_history ADD CONSTRAINT finding_history_finding_org_fk
  FOREIGN KEY (organization_id, scope_finding_id) REFERENCES scope_findings(organization_id, id) ON DELETE CASCADE;

ALTER TABLE billing_events ADD CONSTRAINT billing_events_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE billing_events ADD CONSTRAINT billing_events_finding_org_fk
  FOREIGN KEY (organization_id, scope_finding_id) REFERENCES scope_findings(organization_id, id) ON DELETE CASCADE;

ALTER TABLE reports ADD CONSTRAINT reports_project_org_fk
  FOREIGN KEY (organization_id, project_id) REFERENCES projects(organization_id, id) ON DELETE CASCADE;
ALTER TABLE reports ADD CONSTRAINT reports_current_version_org_fk
  FOREIGN KEY (organization_id, current_version_id) REFERENCES report_versions(organization_id, id);
ALTER TABLE report_versions ADD CONSTRAINT report_versions_report_org_fk
  FOREIGN KEY (organization_id, report_id) REFERENCES reports(organization_id, id) ON DELETE CASCADE;

ALTER TABLE sync_checkpoints ADD CONSTRAINT sync_checkpoints_connection_org_fk
  FOREIGN KEY (organization_id, connection_id) REFERENCES communication_connections(organization_id, id) ON DELETE CASCADE;
