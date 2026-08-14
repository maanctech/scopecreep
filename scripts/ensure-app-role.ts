import { Pool } from "pg";
import { PURPOSE_ROLES } from "../lib/db/tenantContext";

/**
 * Creating a role and granting it anything needs rights the application
 * account deliberately lacks, so this runs on the owner connection migrations
 * use rather than the one the application connects with.
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

function ownerUrl() {
  const value = process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!value) throw new Error("DATABASE_MIGRATION_URL is required to provision the application role.");

  return value;
}

async function main() {
  if (!ROLE || !PASSWORD) {
    throw new Error("SCOPELEDGER_DB_APP_USER and SCOPELEDGER_DB_APP_PASSWORD are required to provision the application role.");
  }

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ROLE)) {
    throw new Error("SCOPELEDGER_DB_APP_USER must be a plain SQL identifier.");
  }

  const role = quotedIdentifier(ROLE);
  const pool = new Pool({ connectionString: ownerUrl(), max: 1 });

  try {
    const existing = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
      [ROLE]
    );

    if (existing.rows[0]?.rolsuper || existing.rows[0]?.rolbypassrls) {
      throw new Error(`Role "${ROLE}" holds SUPERUSER or BYPASSRLS and would read past every tenant policy. Remove those attributes before starting.`);
    }

    const verb = existing.rows[0] ? "ALTER" : "CREATE";

    await pool.query(`${verb} ROLE ${role} LOGIN PASSWORD ${quotedLiteral(PASSWORD)}`);

    await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
    await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
    await pool.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${role}`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`);
    await pool.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`);

    for (const purpose of Object.values(PURPOSE_ROLES)) {
      if (purpose) await pool.query(`GRANT ${quotedIdentifier(purpose)} TO ${role}`);
    }

    const assumable = await pool.query<{ rolname: string }>(
      `SELECT purpose.rolname FROM pg_auth_members membership
       JOIN pg_roles purpose ON purpose.oid = membership.roleid
       JOIN pg_roles holder ON holder.oid = membership.member
       WHERE holder.rolname = $1 ORDER BY purpose.rolname`,
      [ROLE]
    );

    console.log(`Application role "${ROLE}" is provisioned without SUPERUSER or BYPASSRLS.`);
    console.log(`It may assume: ${assumable.rows.map((row) => row.rolname).join(", ") || "nothing"}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
