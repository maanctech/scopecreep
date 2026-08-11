# Retired code

Nothing here is part of how ScopeLedger ships. It is kept because it worked
when it was retired and reconstructing it later would cost more than storing
it.

Retired is not abandoned. Anything in here that can be checked without running
it is still checked, so it does not rot into a fallback that no longer works
the day it is wanted. `tests/installation.test.ts` covers `docker/`.

## docker/

The self-hosted install path: an application container, a private PostgreSQL 15
container, and persistent volumes. Retired because it targets operators, and
ScopeLedger is sold to professionals who will not install Docker Desktop.

Two hard dependencies live here rather than in the main tree, and both have to
be answered before any other deployment target is chosen:

- **Backups shell out to `pg_dump`.** `lib/backups/native.ts` spawns
  `pg_dump` and `pg_restore` as child processes, which is why the image
  installs `postgresql-client-15`. Serverless hosts have neither binary.
- **The tenant boundary depends on an unprivileged database role.** The
  entrypoint provisions one and refuses to start without it. A managed
  database gives out a superuser by default, and row-level security does not
  apply to superusers. See `docs/row-level-security.md`, which is *not*
  retired.

To use it, run `docker compose` commands from this directory — the build
context points back at the repository root. See `docker/installation.md`.

## ollama/

The local-model AI provider, and the tests that covered it. Retired because it
was only reachable through the self-hosted path, and because "install Ollama
and pull a 12B model" is not an onboarding step a professional audience will
complete.

Unlike `docker/`, this code is unwired, not merely moved. `AiProviderName` no
longer includes `"ollama"`, so **these files do not compile against the current
types**, and `legacy/` is excluded from `tsconfig.json` and ESLint for that
reason. `ollama.test.ts` does not run either — Vitest only collects `tests/**`.

Reviving it, in order:

1. Restore the `ollama` entry in `constants/json/ai.json` under both
   `providerNames` and `providerCatalog`, then `npm run constants:generate`.
2. Move `ollama.ts` back to `lib/ai/` and re-add its factory line in
   `lib/ai/providers.ts`.
3. Move `check-ollama.ts` back to `scripts/` and restore the `ollama:check`
   script in `package.json`.
4. Move `ollama.test.ts` back to `tests/`, fixing its import path.
5. Restore `OLLAMA_BASE_URL` validation in `lib/config/runtime.ts`.

Step 1 alone makes the rest typecheck. Note that the marketing copy no longer
claims local-model support, so reviving the provider means reinstating those
claims deliberately rather than finding them still there.
