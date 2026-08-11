import packageJson from "@/package.json";
import { configuredProviderHealth } from "@/lib/ai/providers";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import { query } from "@/lib/db/client";
import { loadMigrations } from "@/lib/db/migrations";
import { redactLogMetadata } from "@/lib/observability/logger";

type Row = Record<string, unknown>;

function configurationChecks() {
  const checks = [
    {
      name: "PostgreSQL storage",
      ok: Boolean(process.env.DATABASE_URL?.trim()),
      message: process.env.DATABASE_URL?.trim()
        ? "DATABASE_URL is configured."
        : "DATABASE_URL is missing; commercial storage cannot start."
    },
    {
      name: "Credential encryption",
      ok: Boolean(process.env.SCOPELEDGER_MASTER_KEY?.trim()),
      message: process.env.SCOPELEDGER_MASTER_KEY?.trim()
        ? "The integration-secret master key is configured."
        : "No master key is configured. Integrations cannot save credentials."
    },
    {
      name: "Public origin",
      ok: Boolean(process.env.APP_URL?.trim()),
      message: process.env.APP_URL?.trim()
        ? "APP_URL is configured."
        : "APP_URL is missing. Password-reset links cannot be generated safely."
    }
  ];

  return checks;
}

export async function applicationHealth() {
  const started = Date.now();

  try {
    await query("SELECT 1");

    return {
      status: "healthy" as const,
      version: packageJson.version,
      database: "reachable" as const,
      latencyMs: Date.now() - started
    };
  } catch {
    return {
      status: "unhealthy" as const,
      version: packageJson.version,
      database: "unreachable" as const,
      latencyMs: Date.now() - started
    };
  }
}

export async function systemDiagnostics() {
  return withAuthenticatedTenant(async (auth) => {

    const [health, ai, migrations, applied, connections, analysisJobs, ingestionJobs] = await Promise.all([
      applicationHealth(),
      configuredProviderHealth(),
      loadMigrations(),
      query<{ version: string; filename: string; checksum: string; applied_at: Date }>(
        "SELECT version,filename,checksum,applied_at FROM schema_migrations ORDER BY version"
      ),
      query<Row>(
        "SELECT provider,status,count(*)::int AS count,max(last_synced_at) AS last_synced_at FROM communication_connections WHERE organization_id=$1 GROUP BY provider,status ORDER BY provider,status",
        [auth.organizationId]
      ),
      query<Row>(
        "SELECT status,count(*)::int AS count,max(updated_at) AS latest FROM analysis_jobs WHERE organization_id=$1 GROUP BY status ORDER BY status",
        [auth.organizationId]
      ),
      query<Row>(
        "SELECT status,count(*)::int AS count,max(updated_at) AS latest FROM ingestion_jobs WHERE organization_id=$1 GROUP BY status ORDER BY status",
        [auth.organizationId]
      )
    ]);
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    return {
      generatedAt: new Date().toISOString(),
      application: health,
      organization: { id: auth.organizationId, name: auth.organizationName },
      configuration: configurationChecks(),
      migrations: {
        expected: migrations.length,
        applied: applied.rows.length,
        pending: migrations.filter((migration) => !appliedVersions.has(migration.version)).map((item) => item.filename),
        latestApplied: applied.rows.at(-1)?.filename || null
      },
      ai,
      integrations: connections.rows,
      analysisJobs: analysisJobs.rows,
      ingestionJobs: ingestionJobs.rows
    };
  });
}

export async function auditLog(limit = 200) {
  return withAuthenticatedTenant(async (auth) => {
    const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
    const rows = await query<Row>(
      `SELECT id,actor_user_id,action,resource_type,resource_id,metadata,created_at
       FROM audit_logs WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2`,
      [auth.organizationId, safeLimit]
    );

    return rows.rows.map((row) => ({
      id: String(row.id),
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      action: String(row.action),
      resourceType: String(row.resource_type),
      resourceId: row.resource_id ? String(row.resource_id) : null,
      metadata: redactLogMetadata(row.metadata),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
    }));
  });
}

export async function supportBundle() {
  const diagnostics = await systemDiagnostics();

  return buildSupportBundle(diagnostics, await auditLog(100));
}

export function buildSupportBundle(
  diagnostics: Record<string, unknown>,
  recentAuditLog: unknown[]
) {
  return {
    bundleVersion: 1,
    notice: "Sensitive values, contract text, communication bodies, credentials, tokens, and email addresses are excluded or redacted.",
    diagnostics: {
      ...redactLogMetadata(diagnostics) as Record<string, unknown>,
      organization: { id: "[REDACTED]", name: "[REDACTED]" }
    },
    recentAuditLog: redactLogMetadata(recentAuditLog)
  };
}
