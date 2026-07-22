# Self-Hosted Installation

This guide describes the supported private-beta installation: one ScopeLedger application container, one private PostgreSQL 15 container, Ollama on the host or a protected local-network machine, and persistent Docker volumes.

## macOS Quick Start

### 1. Install prerequisites

Install:

- Docker Desktop for Mac: <https://docs.docker.com/desktop/setup/install/mac-install/>
- Ollama for macOS: <https://ollama.com/download>

Start both applications. ScopeLedger does not install Docker, start a virtual machine, download an AI model, or run privileged setup commands for you.

### 2. Prepare configuration

From the project directory:

```bash
cp .env.compose.example .env
```

Generate the two required secrets:

```bash
openssl rand -hex 24
openssl rand -base64 32
```

Put the first value in `POSTGRES_PASSWORD` and the second in `SCOPELEDGER_MASTER_KEY`. Keep `.env` private and backed up outside the database. Do not change the master key after saving integration credentials.

The default application origin and bind address are loopback-only:

```text
APP_URL=http://127.0.0.1:3000
SCOPELEDGER_BIND_ADDRESS=127.0.0.1
```

This is the recommended one-machine private-beta configuration. A non-loopback origin must use HTTPS; see **Network and TLS** below.

### 3. Prepare Ollama

On the Mac:

```bash
ollama pull gemma3:12b-it-qat
```

The model is not bundled into ScopeLedger or its container image. Verify the host service before starting ScopeLedger:

```bash
npm run ollama:check
```

Docker uses `http://host.docker.internal:11434` by default. If Ollama does not accept connections from Docker Desktop, review [Ollama Setup](ollama-setup.md); do not expose Ollama to the public internet.

### 4. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
```

The application waits for PostgreSQL, validates production configuration, and applies pending migrations before starting. Watch startup without exposing secrets:

```bash
docker compose logs -f app
```

Check health:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

### 5. Create the first owner

Open:

```text
http://127.0.0.1:3000/setup
```

Create the one-time owner workspace. The setup route disables itself after the first user exists. After creation, ScopeLedger opens AI diagnostics so you can verify the configured model before creating the first project.

### 6. Optional fictional demo

After first-owner setup, seed Northstar Digital Studio / ApertureOps into the only organization:

```bash
docker compose exec app npm run db:seed-demo
```

If the installation has multiple organizations, set `SCOPELEDGER_ORGANIZATION_ID` or use the explicit import command documented in the README. The seed is fictional and is never mixed into real totals.

## Routine Commands

```bash
# Service status and health
docker compose ps
curl --fail http://127.0.0.1:3000/api/health

# Application logs
docker compose logs --tail=200 app

# Apply migrations explicitly
docker compose exec app npm run db:migrate

# Check Ollama from the application network
docker compose exec app npm run ollama:check

# Create a verified installation backup
docker compose exec app npm run backup

# Stop or start the installation
docker compose stop
docker compose up -d
```

Backup archives are stored in the `scopeledger_backups` Docker volume. Copy a completed archive to encrypted off-host storage:

```bash
docker compose cp app:/app/backups/<backup-file>.tar.gz ./<backup-file>.tar.gz
```

See [Backup and Restore](backup-and-restore.md) before any restore.

## Persistence

- `scopeledger_postgres` contains the PostgreSQL database.
- `scopeledger_app_data` contains private SOW originals, imported document files, generated demo JSON when requested, and pre-import logical safety copies.
- `scopeledger_backups` contains installation backup archives.

`docker compose down` preserves named volumes. `docker compose down -v` deletes them and must never be used on an installation containing data unless a verified off-host backup exists and deliberate data destruction is intended.

## Update Procedure

1. Create and copy an off-host installation backup.
2. Review release notes and migration notes.
3. Fetch or place the new source release in the installation directory.
4. Run `docker compose build --pull`.
5. Run `docker compose up -d`.
6. Confirm `/api/health`, migration status, sign-in, one project, and report history.

The entrypoint applies only checked-in, checksum-protected migrations. It stops startup if an already-applied migration file changed.

## Network and TLS

The default Compose file publishes only to `127.0.0.1`. For access from another machine, put an HTTPS reverse proxy in front of the loopback application port, set `APP_URL` to the exact external HTTPS origin, and preserve the external `Host` header. Do not publish PostgreSQL or Ollama to an untrusted network.

ScopeLedger rejects a non-loopback `http://` `APP_URL`. HTTPS makes session cookies secure and protects SOW, message, credential, and report traffic. TLS certificate and reverse-proxy automation are operator responsibilities in the private beta.

## Linux and Windows Notes

- Linux Docker Engine with the Compose plugin can use the same file. `host.docker.internal` is mapped with `host-gateway`; verify the host firewall and Ollama bind configuration.
- Windows Docker Desktop can use the same Compose file and `host.docker.internal` default.
- Use forward-slash container paths exactly as documented, even when the host uses Windows paths.
- Never place private data in the source tree as a substitute for Docker volumes.

## Installation Verification Status

The application build, startup configuration, migration runner, database readiness logic, health endpoint, backup format, and restore orchestration have automated tests. Docker Compose validation and image/startup smoke tests run when Docker is available. Docker was not installed on the current macOS development host at the time this guide was written, so this repository does not claim a successful container build on that host yet.
