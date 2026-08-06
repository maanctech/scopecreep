import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateProductionConfiguration } from "@/lib/config/runtime";

const root = process.cwd();
const read = (filename: string) => readFileSync(path.join(root, filename), "utf8");
const dockerAvailable = spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0;

describe("self-hosted installation assets", () => {
  it("rejects invalid analysis context and stale-job settings", () => {
    const errors = validateProductionConfiguration({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost/scopeledger",
      APP_URL: "http://127.0.0.1:3000",
      SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64"),
      AI_PROVIDER: "ollama",
      OLLAMA_NUM_CTX: "2048",
      ANALYSIS_STALE_MINUTES: "0",
      INGESTION_STALE_MINUTES: "later",
      SMTP_USER: "smtp-user",
      SMTP_PASSWORD: "",
      SMTP_PORT: "70000",
      DAILY_DIGEST_HOUR: "24",
      APP_TIMEZONE: "Not/A_Real_Zone",
    });

    expect(errors).toContain(
      "OLLAMA_NUM_CTX must be an integer of at least 4096.",
    );
    expect(errors).toContain("ANALYSIS_STALE_MINUTES must be a positive integer.");
    expect(errors).toContain("INGESTION_STALE_MINUTES must be a positive integer.");
    expect(errors).toContain("SMTP_PORT must be an integer between 1 and 65535.");
    expect(errors).toContain("DAILY_DIGEST_HOUR must be an integer between 0 and 23.");
    expect(errors).toContain("APP_TIMEZONE must be a valid IANA time zone.");
    expect(errors).toContain("SMTP_HOST is required when SMTP is configured.");
    expect(errors).toContain("SMTP_FROM is required when SMTP is configured.");
    expect(errors).toContain(
      "SMTP_USER and SMTP_PASSWORD must either both be set or both be blank.",
    );
  });

  it("builds a non-root runtime with matching PostgreSQL backup tools and health checks", () => {
    const dockerfile = read("Dockerfile");

    expect(dockerfile).toContain("FROM node:22-bookworm-slim AS runtime");
    expect(dockerfile).toContain("postgresql-client-15");
    expect(dockerfile).toContain("USER scopeledger");
    expect(dockerfile).toContain("/api/health");
    expect(dockerfile).not.toMatch(/COPY\s+(?:\.\s+\.|data|backups)/);
  });

  it("keeps PostgreSQL private, binds the app to loopback by default, and persists required state", () => {
    const compose = read("compose.yaml");
    const postgresService = compose.split("\n  app:")[0];

    expect(compose).toContain("image: postgres:15-bookworm");
    expect(compose).toContain("${SCOPELEDGER_BIND_ADDRESS:-127.0.0.1}");
    expect(postgresService).not.toContain("\n    ports:");

    for (const volume of [
      "scopeledger_postgres",
      "scopeledger_app_data",
      "scopeledger_backups"
    ]) {
      expect(compose).toContain(volume);
    }

    expect(compose).toContain("http://host.docker.internal:11434");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain('command: ["npm", "run", "worker"]');
    expect(compose).toContain("AUTOMATION_LEASE_MINUTES");
    expect(compose).toContain("SMTP_PASSWORD: ${SMTP_PASSWORD:-}");
    expect(compose).toContain("healthcheck:\n      disable: true");
  });

  it("validates configuration and database readiness before migration and startup", () => {
    const entrypoint = read("scripts/docker-entrypoint.sh");
    const configAt = entrypoint.indexOf("npm run config:check");
    const waitAt = entrypoint.indexOf("npm run db:wait");
    const migrateAt = entrypoint.indexOf("npm run db:migrate");
    const execAt = entrypoint.indexOf('exec "$@"');

    expect(configAt).toBeGreaterThan(-1);
    expect(configAt).toBeLessThan(waitAt);
    expect(waitAt).toBeLessThan(migrateAt);
    expect(migrateAt).toBeLessThan(execAt);
  });

  it("ships placeholders and generation commands instead of committed secrets", () => {
    const environment = read(".env.compose.example");

    expect(environment).toContain("POSTGRES_PASSWORD=");
    expect(environment).toContain("SCOPELEDGER_MASTER_KEY=");
    expect(environment).toContain("openssl rand -hex 24");
    expect(environment).toContain("openssl rand -base64 32");
    expect(environment).not.toMatch(/POSTGRES_PASSWORD=\S+/);
    expect(environment).not.toMatch(/SCOPELEDGER_MASTER_KEY=\S+/);
  });

  it.skipIf(!dockerAvailable)("passes Docker Compose configuration validation", () => {
    execFileSync("docker", ["compose", "-f", "compose.yaml", "config", "--quiet"], {
      cwd: root,
      env: {
        ...process.env,
        POSTGRES_PASSWORD: "test-only-hex-password",
        SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64")
      },
      stdio: "pipe"
    });
  });
});
