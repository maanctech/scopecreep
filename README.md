# ScopeLedger

## Project Overview

ScopeLedger is a local-first revenue recovery workspace for B2B service firms. It compares Statements of Work against client requests, identifies likely unbilled out-of-scope work, and gives the professional a controlled workflow for review, change-order drafting, invoicing status, and recovered-revenue tracking.

The product helps professional service firms compare Statements of Work against client requests, identify likely unbilled out-of-scope work, estimate recoverable revenue, and draft polite change order language for a project manager to review.

## Current Product Positioning

We help service businesses recover unbilled revenue by detecting out-of-scope client requests before they become free work.

This is a forensic revenue audit tool for agencies, software development shops, consultancies, law firms, and other service firms. It is not a chatbot and does not send invoices, emails, or change orders automatically.

## Quickstart

Install dependencies:

```bash
npm install
```

Copy the environment template and set at least `DATABASE_URL` and `SCOPELEDGER_MASTER_KEY`:

```bash
cp .env.example .env.local
```

Apply database migrations, then create the first owner (or do this later at `/setup`):

```bash
npm run db:migrate
npm run db:create-admin
```

Start the dev server (Next.js on Turbopack):

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

For the supported self-hosted container path, see [Self-Hosted Installation](docs/installation.md) instead.

### Before committing

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run lint` runs ESLint; `npm run format` runs the same ESLint ruleset with `--fix`. There is no separate Prettier step — formatting is owned by ESLint `@stylistic` (see `AGENTS.md`).

## Documentation

- [Product Overview](docs/product-overview.md) - current MVP features, routes and pages, and API routes.
- [Architecture](docs/architecture.md) - system overview and component responsibilities.
- [Self-Hosted Installation](docs/installation.md) - the supported Docker/PostgreSQL/Ollama install path.
- [Security Model](docs/security-model.md) - trust boundaries and current controls.
- [Troubleshooting](docs/troubleshooting.md) - common startup and runtime problems.

The full documentation set, grouped by topic, is indexed in [`docs/README.md`](docs/README.md).
