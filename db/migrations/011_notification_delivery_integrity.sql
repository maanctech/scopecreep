ALTER TABLE project_automation_settings
  DROP CONSTRAINT project_automation_enabler_org_fk;

CREATE FUNCTION validate_project_automation_enabler() RETURNS trigger AS $$
BEGIN
  IF NEW.enabled_by_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM organization_memberships membership
    WHERE membership.organization_id=NEW.organization_id
      AND membership.user_id=NEW.enabled_by_user_id
  ) THEN
    RAISE EXCEPTION 'automation enabler must be a member of the project organization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_automation_enabler_guard
BEFORE INSERT OR UPDATE OF organization_id,enabled_by_user_id
ON project_automation_settings
FOR EACH ROW EXECUTE FUNCTION validate_project_automation_enabler();

ALTER TABLE professional_notifications
  ADD COLUMN dedupe_key text;

CREATE UNIQUE INDEX professional_notifications_dedupe_idx
  ON professional_notifications(organization_id, user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE notification_deliveries
  DROP CONSTRAINT notification_deliveries_status_check;
ALTER TABLE notification_deliveries
  ADD CONSTRAINT notification_deliveries_status_check
  CHECK (status IN ('Pending', 'Sending', 'Succeeded', 'Failed', 'Cancelled'));
