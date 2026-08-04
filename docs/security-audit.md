# Security Audit

Whole-repository review of authentication, authorization, tenancy isolation,
credential handling, input validation, and the deployment surface. Every
finding below was fixed and covered by a test unless the entry says otherwise.

Verification for the fixes: 173 tests, `npm audit` clean, and a live run of the
Docker Compose stack against PostgreSQL 15.

## Fixed

### Sign-in wrote a non-address into an `inet` column

`requestIp()` returns the first `X-Forwarded-For` value, or the literal string
`"local"` when the header is absent. `createSession` passed that straight into
`user_sessions.ip_address`, which is `inet`. PostgreSQL rejects any value that
is not an address, so the whole statement failed and sign-in returned 500.

Reachable two ways: any client sending a non-address header value
(`X-Forwarded-For: anything`), and any deployment behind a proxy that emits the
conventional `unknown` token. Not reachable when Next serves directly, because
Next populates the header from the socket — which is why earlier stack testing
did not surface it.

`inetOrNull()` now maps anything that is not a literal address to `NULL`, for
both `user_sessions` and `audit_logs`.

### Test-mode bypass was not fenced to a test runner

`requireApiPermission()` returned `null` — skipping authentication and
authorization for every API route — whenever `NODE_ENV === "test"`.
`assertSameOrigin()` skipped the cross-origin check on the same condition. A
stray `NODE_ENV=test` on a server would have left the entire API open.

`isTestRuntime()` now requires Vitest's own `VITEST` marker as well, so the
bypass cannot engage outside the runner, and
`validateProductionConfiguration()` rejects `NODE_ENV=test` at startup.
`shouldUsePostgresStorage()` was moved onto the same predicate.

### Login brute force was bypassable

The only login rate limit was keyed on `X-Forwarded-For`, which the client
supplies. Rotating it granted unlimited attempts against one account, and there
was no per-account limit at all.

A second limit now keys on the normalized email, which cannot be spoofed. The
IP limit is unchanged. Verified live: with rotating spoofed IPs, attempts are
refused after the account limit is reached.

### User enumeration through login timing

`authenticateUser()` skipped Argon2 verification entirely when no user matched,
so an unregistered address returned measurably faster than a registered one.
Unknown addresses are now verified against a fixed valid Argon2id digest, so
both paths do the same work.

### Rate-limit map grew without bound

Entries were only replaced when the same key recurred, and keys embed the
spoofable forwarding header. An attacker could mint unlimited distinct keys and
grow the map until the process ran out of memory. Expired entries are now swept
on a 60-second interval and whenever the map passes 10,000 entries — the size
trigger matters because a fast attacker adds far more between two timed sweeps
than the interval alone suggests.

### Two queries were not organization-scoped

`lib/store/postgres/projections.ts` joined `sow_documents` on `project_id`
alone and `sow_versions` on `id` alone; `lib/sow/service.ts` selected
`MAX(version_number)` filtered only by `sow_document_id`. Both are unreachable
in practice because the identifiers are UUIDs already derived from
organization-scoped rows, but AGENTS.md makes organization scoping an
invariant rather than a probability argument, and every neighbouring join in
the same file carries the predicate. Both now do too.

### Authentication events were not audited

`audit_logs` recorded setup and user provisioning but not sign-in, sign-out,
password change, or password reset — the events an incident response needs
first. All four are now written, with the source address when it is a real one.

### Internal error text reached unauthenticated callers

`/api/auth/setup` and `/api/auth/reset-password` returned `error.message`
verbatim for any non-Zod error, which would have surfaced database and runtime
detail. A `PublicError` class now marks the messages that are deliberately
safe to display; anything else returns a generic message with a 500.

### Finding creation duplicated the state machine

`lib/analysisJobs/processing.ts` and both stores each hardcoded the initial
`(billing_decision, workflow_status)` pair, so three copies could drift from
`COMPATIBLE_STATUSES`. `initialFindingState()` in `findingTransitions.ts` is
now the single definition, and a test asserts its output is a pair the state
machine permits for every classification.

### Dependency vulnerabilities

`ip-address` (SSRF and trust-boundary bypass, reachable through
`imapflow` → `socks`) and `postcss` (arbitrary file read via
`sourceMappingURL`) both resolved. `npm audit` reports zero.

## Hardening applied after the first pass

### Content-Security-Policy no longer allows inline script

`script-src` carried `'unsafe-inline'`, which made the policy close to
decorative against XSS. It is now built per request in `proxy.ts` with a fresh
nonce and `strict-dynamic`, so only the nonced bootstrap and what it loads can
execute. Nonces require dynamic rendering, so the three marketing pages and a
now-owned `not-found` route call `connection()`; without that their prerendered
script tags would carry no nonce and be blocked.

`style-src` deliberately keeps `'unsafe-inline'`. Next and React emit inline
style attributes that carry no nonce, injected CSS cannot execute, and the
breakage from removing it outweighs the exposure.

Verified in headless Chrome across every page, including a 404: zero CSP
violations and zero console errors. The detector was itself proven against a
deliberately violating control page first.

### Uploaded documents are checked against their extension

The extension chose the parser, so a file named `.docx` could hand arbitrary
content to the zip reader. The leading bytes now have to match the extension,
and extracted text is capped at 2 MB before it reaches the database or a model
prompt.

### Sessions now expire on inactivity

`last_seen_at` existed but was never written, so a session stayed valid for its
full 12 hours no matter what. It is advanced on every authenticated lookup, and
a session idle for more than four hours is refused. Both are enforced in the
same statement that loads the auth context.

### The master key can be rotated

There was no way to retire a leaked `SCOPELEDGER_MASTER_KEY` without manually
re-encrypting every stored credential. `SCOPELEDGER_PREVIOUS_MASTER_KEY` is now
tried on decryption, so the key can be replaced while old ciphertext stays
readable and new writes use the current key. Startup validation rejects a
previous key that is malformed or identical to the current one.

### Dead code and an unused dependency removed

`lib/supabase.ts` was imported nowhere and `@supabase/supabase-js` was unused —
credential-handling code and a dependency with no purpose. Both are gone.

## Reviewed and found sound

- **Password storage** - Argon2id, 19 MiB / t=3 / p=1, meeting the OWASP floor.
- **Session tokens** - 256-bit random, stored only as SHA-256, 12-hour expiry,
  revoked on password change and reset.
- **Cookies** - `httpOnly`, `SameSite=Lax`, `Secure` derived from `APP_URL`.
- **CSRF** - origin/host compared with `timingSafeEqual` on every mutation.
- **SQL injection** - no query anywhere builds SQL by interpolation.
- **Credential encryption** - AES-256-GCM with a random IV and an
  organization- and connection-bound AAD.
- **OAuth** - PKCE S256, hashed single-use state under `FOR UPDATE`, 10-minute
  expiry, encrypted verifier.
- **Webhooks** - HMAC-SHA256 over `timestamp.body`, constant-time compare,
  300-second replay window, delivery-ID idempotency with payload-hash reuse
  detection.
- **SSRF** - private ranges blocked with a re-check at socket connect time,
  which closes DNS rebinding.
- **Path traversal** - upload filenames are basenamed, character-filtered and
  extension-checked; backup manifests accept only two literal filenames.
- **Log redaction** - centralized, key- and pattern-based, applied to support
  bundles too.
- **Audit and billing history are append-only** - triggers from migration 001
  reject UPDATE and DELETE on `audit_logs` and `billing_events`. Verified by
  attempting both against a migrated database.
- **Security headers** - CSP, HSTS, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, COOP/CORP, `Permissions-Policy`.
- **Container** - non-root `scopeledger` user, `tini` as PID 1.
- **Startup validation** - `npm start` refuses to boot on invalid production
  configuration.

## Open, not fixed

- **Document and email parsers run in the app process.** `unpdf`, `mammoth`,
  and `mailparser` handle attacker-influenced bytes with no memory or CPU
  isolation. Signature checks, a 10 MB input cap, and a 2 MB output cap bound
  what reaches the rest of the system, but they do not bound the parser itself:
  a decompression bomb or a pathological file can still exhaust memory or block
  the event loop. Real isolation means a separate process or container with
  limits, which is an architectural change. Note the reachability difference —
  SOW upload requires an authenticated member with `projects:write`, so that
  path is an insider risk, while IMAP-fetched mail is genuinely external.
- **No multi-factor authentication.** Password-only for a product holding client
  contracts and billing decisions. This is a product feature with enrollment,
  recovery codes, and a login-flow change; it deserves its own cycle rather than
  being bolted on.
- **Rate limiting is in-memory and per-process.** It resets on restart and
  multiplies across instances. Adequate for the documented single-container
  install, wrong the moment anyone scales out.
- **`X-Forwarded-For` is trusted with no proxy allowlist.** The per-account
  login limit does not depend on it, but every other IP-keyed limit does and can
  be evaded by rotating the header.
- **Audit history has no external anchoring.** Append-only triggers stop the
  application and any normal session from rewriting history, but an operator
  with superuser access can drop a trigger. Detecting that needs hashes
  published somewhere the database cannot reach.
- **The role matrix is uneven.** `Read Only` holds `members:read` and
  `backups:read` while `Reviewer`, nominally more privileged, does not. Not an
  escalation — `Read Only` gains no write capability — but the asymmetry looks
  unintended. Left alone because changing it is a product decision.
- **The facade dispatch layer still has no test.** `SCOPELEDGER_STORAGE=postgres`
  now overrides the test-mode default, which unblocks writing one, but
  `requireContext()` still needs a real request scope.

## Corrections to the first pass

The first pass listed audit-log tamper-evidence as missing. That was wrong:
migration 001 already enforces append-only on `audit_logs` and `billing_events`
with triggers. A redundant migration adding the same protection was written and
then removed once the existing one was found. What is genuinely missing is
external anchoring, recorded above.
