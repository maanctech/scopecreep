-- System access was one switch: inside it every table was readable and
-- writable for every organization, however narrow the work actually was. Job
-- recovery needs analysis_jobs and could read every firm's findings. The
-- restriction lives in table privileges rather than in the policies, so a
-- purpose reaching outside its tables is refused before a policy is consulted
-- and the 34 tenant policies stay as they are.

DO $$
DECLARE
  purpose text;
BEGIN
  FOREACH purpose IN ARRAY ARRAY[
    'scopeledger_provisioning',
    'scopeledger_directory_sync',
    'scopeledger_webhook_routing',
    'scopeledger_job_recovery',
    'scopeledger_bootstrap'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = purpose) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', purpose);
    END IF;

    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', purpose);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', purpose);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON organizations, users, organization_memberships
  TO scopeledger_provisioning;

GRANT SELECT, INSERT, UPDATE, DELETE ON organizations, users, organization_memberships
  TO scopeledger_directory_sync;

GRANT SELECT ON communication_connections, encrypted_secrets
  TO scopeledger_webhook_routing;

GRANT SELECT, UPDATE ON analysis_jobs
  TO scopeledger_job_recovery;

GRANT SELECT ON organizations, organization_settings
  TO scopeledger_bootstrap;
