ALTER TABLE report_versions
  DROP CONSTRAINT report_versions_type_check;

ALTER TABLE report_versions
  ADD CONSTRAINT report_versions_type_check CHECK (
    report_type IN (
      'Internal Scope Audit',
      'Finding Summary',
      'Revenue Leakage Report',
      'Client Discussion Brief',
      'Change Order Draft',
      'Invoice Support Summary',
      'Weekly Monitoring Summary'
    )
  );
