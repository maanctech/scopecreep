# Constants

`constants/json/` is the ground truth for shared vocabulary and tunable limits. Everything under `constants/typescript/` and `constants/javascript/` is generated from it and must never be hand-edited.

```
constants/
  json/         hand-edited ground truth
  typescript/   generated, imported as @/constants/typescript/<module>
  javascript/   generated .mjs, imported by scripts/*.mjs
```

## Changing a constant

1. Edit the file in `constants/json/`.
2. Run `npm run constants:generate`.
3. Run `npm test`. If the value is enforced by a database CHECK constraint, `tests/constantsSqlParity.test.ts` will fail until a new migration widens or replaces that constraint.

Applied migrations are immutable, so the SQL side is never regenerated — the parity test only detects drift. Changing a database-backed enumeration means writing a new migration.

## Why the TypeScript modules are generated rather than imported

TypeScript widens an imported JSON array to `string[]`. Every union in the app is derived from an `as const` array, so importing the JSON directly would erase `Classification`, `WorkflowStatus`, `Permission` and the rest down to `string`.

Almost nothing fails loudly when that happens — Zod accepts a `string[]` for `z.enum`, so the call sites keep compiling and quietly stop constraining anything. `tests/constantsSync.test.ts` holds a compile-time guard against the widening for exactly that reason.

Domain modules keep their own type aliases and re-export the arrays, so call sites continue to import from `@/lib/types`, `@/lib/auth/types` and friends rather than reaching into `constants/`.

## Notes on individual values

- `auth.sessionIdleTimeout` — a Postgres interval string. A session dies after this long without a request, so an unattended browser stops being a valid credential well before `sessionDurationMs` elapses. `last_seen_at` is advanced on every authenticated request.
- `sow.maxExtractedCharacters` — a DOCX is a zip and a PDF carries its own compression, so a small upload can decompress into an unbounded amount of text. The cap applies to whatever the parser returns, before it reaches the database or a model prompt. It does not bound the parser's own memory use; see `docs/security-audit.md`.
- `ingestion.webhookSignatureWindowSeconds` — how far a webhook timestamp may drift before the signature is rejected as a replay.
- `ingestion.maxImportBytes` and `ingestion.maxEmailSourceBytes` are separate caps that happen to sit near each other: the first bounds a pasted or uploaded import, the second bounds a single fetched IMAP message. The manual import route adds a fixed allowance on top of `maxImportBytes` for the surrounding JSON envelope.
- `ai.providerNames` includes `demo`, which `ai.providerCatalog` deliberately does not — the demo analyzer is test-only and contacts no provider. `RemoteAiProviderName` is the difference between the two, and the catalog is typed as a `Record` over it, so adding a name here without a catalog entry is a compile error.
- `domain.auditRequestStatuses`, `sow.documentStatuses` and the other database-only enumerations have no TypeScript consumer yet. They are declared here so the parity test can hold the schema to a single written-down vocabulary.
