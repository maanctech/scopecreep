import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { closePool, query, transaction } from "../lib/db/client";
import { executeJsonImport, prepareJsonImport } from "../lib/db/jsonImport";

function argument(name: string) {
  const prefix = `${name}=`;

  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const backupTables = [
  "companies", "leads", "lead_status_history", "audit_requests", "projects", "sow_documents",
  "sow_versions", "sow_sections", "scope_boundary_maps", "scope_boundary_items",
  "communication_connections", "encrypted_secrets", "communication_sources", "communication_threads",
  "client_messages", "communication_attachments", "ingestion_jobs", "analysis_jobs", "scope_findings",
  "scope_finding_history", "billing_events", "reports", "report_versions", "sales_templates",
  "sync_checkpoints", "organization_settings", "audit_logs", "backup_records"
] as const;

async function createPreImportBackup(organizationId: string) {
  const tables: Record<string, unknown[]> = {};

  for (const table of backupTables) {
    const result = await query(`SELECT * FROM ${table} WHERE organization_id = $1`, [organizationId]);

    tables[table] = result.rows;
  }

  const payload = JSON.stringify({
    format: "scopeledger-logical-backup-v1",
    organization_id: organizationId,
    created_at: new Date().toISOString(),
    tables
  }, null, 2);
  const directory = path.join(process.cwd(), "data", "import-backups");

  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, `pre-import-${organizationId}-${Date.now()}.json`);
  const temporary = `${filename}.tmp`;

  await fs.writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, filename);
  const checksum = createHash("sha256").update(payload).digest("hex");

  await query(
    `INSERT INTO backup_records
     (id, organization_id, status, storage_path, checksum_sha256, byte_size, created_at, completed_at)
     VALUES ($1,$2,'Succeeded',$3,$4,$5,now(),now())`,
    [randomUUID(), organizationId, filename, checksum, Buffer.byteLength(payload)]
  );

  return filename;
}

async function main() {
  const filename = path.resolve(argument("--file") || path.join("data", "demo-store.json"));
  const raw = JSON.parse(await fs.readFile(filename, "utf8")) as unknown;
  const plan = prepareJsonImport(raw);

  console.log(JSON.stringify({ file: filename, mode: process.argv.includes("--apply") ? "apply" : "dry-run", ...plan.summary, warnings: plan.warnings }, null, 2));

  if (!process.argv.includes("--apply")) {
    console.log("Dry run only. Re-run with --apply and --organization=<uuid> after reviewing this summary.");

    return;
  }

  let organizationId = argument("--organization") || process.env.SCOPELEDGER_ORGANIZATION_ID;

  if (!organizationId) {
    const organizations = await query<{ id: string }>("SELECT id FROM organizations ORDER BY created_at");

    if (organizations.rowCount !== 1) {
      throw new Error("--organization=<uuid> is required unless the installation has exactly one organization.");
    }

    organizationId = organizations.rows[0].id;
  }

  const organization = await query("SELECT id FROM organizations WHERE id = $1", [organizationId]);

  if (!organization.rowCount) throw new Error("Organization not found. Complete first-run setup before importing.");

  const backup = await createPreImportBackup(organizationId);

  console.log(`Pre-import backup created at ${backup}.`);
  await transaction((client) => executeJsonImport(client, organizationId, plan));
  console.log("Import committed successfully.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
