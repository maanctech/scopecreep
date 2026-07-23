# Private-Beta Release Checklist

Record the date, operator, commit, host, and evidence for every completed item. An unchecked release gate must remain visible; do not convert assumptions into checkmarks.

## Required Technical Gates

- [x] Baseline Phase 1 committed without secrets or runtime customer data.
- [x] Empty PostgreSQL migrations 001-008 verified on a fresh local database.
- [x] Fictional Northstar JSON imports with the $13,475 total.
- [x] Authentication, role authorization, organization isolation, protected API, and security regression tests pass.
- [x] Approved-SOW, import, deduplication, findings, billing transitions, reports, and exports pass local tests.
- [x] Production build passes.
- [x] Backup and restore orchestration has automated coverage.
- [x] Real Ollama model completes the structured analysis fixture on the current verification host.
- [ ] Docker image builds and Compose starts on release hardware.
- [ ] Real containerized backup and destructive restore drill succeeds on disposable data.
- [x] Full browser workflow is rerun against the final production build.
- [x] Final secret, private-data, dependency, and Git-status audit is clean for the repository and current host.

## Operational Gates

- [ ] HTTPS and network boundary reviewed for any non-loopback installation.
- [ ] Off-host encrypted backup location and restore owner assigned.
- [ ] Operator and professional-user training completed.
- [ ] Selected model, timeout, and capacity validated on customer hardware.
- [ ] Customer retention policy and incident contacts documented.
- [ ] Customer-owned connector credentials verified only for integrations in scope.

## External and Commercial Gates

- [ ] Customer contract, privacy terms, and security representations reviewed by qualified counsel.
- [ ] Provider applications and tenant approvals completed where required.
- [ ] Domain, TLS certificate, support terms, and private-beta scope confirmed.
- [ ] No mocked or credential-dependent connector is described as verified live.

Current classification is **Internal Alpha**. Real-model and full browser gates pass, but Docker image/startup and a real database backup/restore drill remain open. The evidence does not support `Paid Private Beta Ready` or `Public Production Ready`.
