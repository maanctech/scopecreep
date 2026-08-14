import { closePool, query, transaction } from "../lib/db/client";
import { withSystemAccess, type SystemPurpose } from "../lib/db/tenantContext";

type RoleRow = { rolname: string; rolsuper: boolean; rolbypassrls: boolean };
type TableRow = { relname: string };

async function main() {
  const role = await withSystemAccess("diagnostics", () => query<RoleRow>(
    "SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  ));
  const connected = role.rows[0];

  if (!connected) throw new Error("Could not read the connected role from pg_roles.");

  const problems: string[] = [];

  if (connected.rolsuper) {
    problems.push(`"${connected.rolname}" is a superuser. PostgreSQL exempts superusers from row-level security, and FORCE ROW LEVEL SECURITY does not change that, so every tenant policy is inert.`);
  }

  if (connected.rolbypassrls) {
    problems.push(`"${connected.rolname}" holds BYPASSRLS, so it reads and writes past every tenant policy.`);
  }

  const unprotected = await withSystemAccess("diagnostics", () => query<TableRow>(`
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'schema_migrations'
      AND (c.relrowsecurity = false OR c.relforcerowsecurity = false)
    ORDER BY c.relname
  `));

  if (unprotected.rows.length) {
    problems.push(`These tables do not have row-level security enabled and forced: ${unprotected.rows.map((row) => row.relname).join(", ")}.`);
  }

  if (problems.length) {
    console.error("Row-level security is not being enforced:");

    for (const problem of problems) console.error(`- ${problem}`);

    console.error("\nCreate a dedicated login role that owns nothing and is neither a superuser nor BYPASSRLS, grant it CRUD on the public schema, and point DATABASE_URL at it.");
    process.exitCode = 1;

    return;
  }

  console.log(`Row-level security is enforced for "${connected.rolname}" across every table.`);

  await reportPurposeScoping();
}

const OUT_OF_REACH: Array<{ purpose: SystemPurpose; allowed: string; refused: string }> = [
  { purpose: "job-recovery", allowed: "analysis_jobs", refused: "scope_findings" },
  { purpose: "provisioning", allowed: "organizations", refused: "encrypted_secrets" },
  { purpose: "webhook-routing", allowed: "communication_connections", refused: "analysis_jobs" },
  { purpose: "directory-sync", allowed: "organization_memberships", refused: "encrypted_secrets" },
  { purpose: "bootstrap", allowed: "organization_settings", refused: "scope_findings" }
];

async function reachable(purpose: SystemPurpose, table: string) {
  try {
    await withSystemAccess(purpose, () => query(`SELECT 1 FROM ${table} LIMIT 1`));

    return true;
  } catch (error) {
    if (/permission denied/i.test(error instanceof Error ? error.message : "")) return false;

    throw error;
  }
}

class RolledBack extends Error {}

/**
 * Reading proves nothing about a purpose that writes. A missing insert grant
 * would serve every existing account and fail only the first sign-in of a new
 * one, so the write is attempted for real and then rolled back.
 */
async function writable(purpose: SystemPurpose, statement: string) {
  try {
    await withSystemAccess(purpose, () => transaction(async (client) => {
      await client.query(statement);

      throw new RolledBack();
    }));

    return true;
  } catch (error) {
    if (error instanceof RolledBack) return true;

    if (/permission denied/i.test(error instanceof Error ? error.message : "")) return false;

    throw error;
  }
}

const MUST_WRITE: Array<{ purpose: SystemPurpose; statement: string; describes: string }> = [
  {
    purpose: "provisioning",
    describes: "create a firm on its first sign-in",
    statement: "INSERT INTO organizations (id, name, slug) VALUES (gen_random_uuid(), 'probe', 'probe-' || gen_random_uuid())"
  },
  {
    purpose: "provisioning",
    describes: "create the person signing in",
    statement: "INSERT INTO users (id, email, normalized_email, display_name) VALUES (gen_random_uuid(), 'probe@example.invalid', 'probe@example.invalid', 'Probe')"
  },
  {
    purpose: "job-recovery",
    describes: "return a stalled job to the queue",
    statement: "UPDATE analysis_jobs SET updated_at = now() WHERE false"
  }
];

async function reportPurposeScoping() {
  const problems: string[] = [];

  for (const { purpose, allowed, refused } of OUT_OF_REACH) {
    if (!await reachable(purpose, allowed)) problems.push(`"${purpose}" cannot reach ${allowed}, which it needs.`);

    if (await reachable(purpose, refused)) problems.push(`"${purpose}" can reach ${refused}, which it must not.`);
  }

  for (const { purpose, statement, describes } of MUST_WRITE) {
    if (!await writable(purpose, statement)) problems.push(`"${purpose}" cannot ${describes}.`);
  }

  if (problems.length) {
    console.error("\nSystem access is not scoped to its purpose:");

    for (const problem of problems) console.error(`- ${problem}`);

    console.error("\nRun npm run db:ensure-app-role so the application role may assume each purpose role.");
    process.exitCode = 1;

    return;
  }

  console.log(`Each system-access purpose reaches its own tables, writes what it must, and is refused the rest (${OUT_OF_REACH.length} read, ${MUST_WRITE.length} write).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
