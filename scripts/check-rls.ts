import { closePool, query } from "../lib/db/client";
import { withSystemAccess } from "../lib/db/tenantContext";

type RoleRow = { rolname: string; rolsuper: boolean; rolbypassrls: boolean };
type TableRow = { relname: string };

async function main() {
  const role = await withSystemAccess(() => query<RoleRow>(
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

  const unprotected = await withSystemAccess(() => query<TableRow>(`
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
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
