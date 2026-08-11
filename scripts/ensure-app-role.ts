import { closePool, query } from "../lib/db/client";
import { withSystemAccess } from "../lib/db/tenantContext";

/**
 * Runs as the schema owner, immediately after migrations, to provision the
 * unprivileged role the application itself connects as. The two identities
 * have to differ: creating tables needs rights that would also let the
 * connection read past every tenant policy.
 */
const ROLE = process.env.SCOPELEDGER_DB_APP_USER;
const PASSWORD = process.env.SCOPELEDGER_DB_APP_PASSWORD;

/**
 * Role names and passwords cannot be bound as parameters in CREATE ROLE, so
 * both are quoted here. The role name is additionally constrained to a plain
 * identifier below, leaving the password as the only free-form value.
 */
function quotedIdentifier(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function quotedLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  if (!ROLE || !PASSWORD) {
    throw new Error("SCOPELEDGER_DB_APP_USER and SCOPELEDGER_DB_APP_PASSWORD are required to provision the application role.");
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ROLE)) {
    throw new Error("SCOPELEDGER_DB_APP_USER must be a plain SQL identifier.");
  }

  const role = quotedIdentifier(ROLE);

  await withSystemAccess(async () => {
    const existing = await query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
      [ROLE]
    );

    if (existing.rows[0]?.rolsuper || existing.rows[0]?.rolbypassrls) {
      throw new Error(`Role "${ROLE}" holds SUPERUSER or BYPASSRLS and would read past every tenant policy. Remove those attributes before starting.`);
    }

    const verb = existing.rows[0] ? "ALTER" : "CREATE";

    await query(`${verb} ROLE ${role} LOGIN PASSWORD ${quotedLiteral(PASSWORD)}`);

    await query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${role}`);
    await query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
    await query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);
  });

  console.log(`Application role "${ROLE}" is provisioned without SUPERUSER or BYPASSRLS.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
