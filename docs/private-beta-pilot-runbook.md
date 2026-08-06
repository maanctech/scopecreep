# Private-Beta Pilot Runbook

## Scope

Run exactly three founder-managed pilots with digital or marketing agencies. Each agency receives a separate Docker installation and database. Do not combine customer data in one installation and do not describe a connector as supported until that installation passes a credentialed smoke test.

Commercial offer: one free historical lookback, then `$1,500` setup and `$750/month` monitoring. Defer performance pricing until attribution and collected payment can be verified independently.

## Qualification

Accept an agency only when it has written SOWs, active Slack or email-based client delivery, a named professional reviewer, a known hourly or blended rate, and authority to supply the selected communication data. Reject pilots that require client login, automatic client contact, automatic invoicing, or unsupported integrations.

## Onboarding Checklist

1. Create the agency's isolated installation and Owner account.
2. Record the installation owner, backup owner, backup location, retention period, and restore-test date.
3. Apply migrations through 012 and record the release commit.
4. Import two or three representative SOWs and approve each boundary map.
5. Configure one real communication source and complete its dated credentialed smoke test.
6. Run a historical audit without enabling automation.
7. Review false positives, false negatives, evidence quality, hours, and approved cents with the project manager.
8. Enable monitoring only after the project manager accepts the boundary and review workflow.
9. Enable the professional-only digest only for an explicit opted-in organization user.
10. Complete a backup and destructive restore drill before relying on the installation for ongoing monitoring.

## Weekly Operation

- Confirm automation and connector health before reviewing findings.
- Resolve failed analysis, changed evidence, and connector alerts first.
- Review each finding against the approved SOW; never bill from AI potential.
- Record approved, invoiced, and paid states only after the professional takes the corresponding external action.
- Generate the Weekly Monitoring Summary and share externally only after professional review.
- Record support time, classification corrections, sync failures, duplicate checks, and workflow friction.

## Pilot Measures

Track onboarding hours, messages ingested, findings created, accepted-finding rate, findings per project, approved cents, invoiced cents, paid cents, review latency, connector failures, duplicate messages/findings, and founder support hours per week.

Exit targets are onboarding under three hours, zero duplicate findings during retries, professional control over every external action, at least one validated billing opportunity per pilot, approved or recovered value materially above `$750/month`, and support that does not require custom engineering each week.

## Incident Rules

- Pause project automation immediately for credential errors, unexplained duplicate ingestion, stale evidence, or financial-total discrepancies.
- Preserve source messages, findings, billing history, report versions, and audit logs. Do not repair customer records with ad hoc SQL.
- Restore only from a verified installation backup and only after stopping the app and worker.
- Do not email SOW or message bodies through the digest. Use protected app links.
- Record provider, timestamp, project, affected run/job IDs, customer impact, and resolution without placing credentials in tickets or logs.

## Evidence Record

For each pilot, retain dated evidence of deployment, migration rerun, backup/restore, connector smoke test, onboarding duration, calibration decisions, weekly metrics, SMTP opt-in/delivery, and final outcome. Never substitute mocked repository tests for live installation evidence.
