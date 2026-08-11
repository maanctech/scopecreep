import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { currentTenantContext } from "@/lib/db/tenantContext";

declare global {
  var __scopeLedgerPool: Pool | undefined;
}

let poolOverride: Pool | undefined;

/**
 * Test-only seam: lets tests substitute a Postgres-compatible pool (for
 * example a PGlite adapter) instead of a real node-postgres connection.
 * Production code never calls this, so normal behavior is unaffected.
 */
export function setPoolForTesting(pool: Pool) {
  poolOverride = pool;
}

export function resetPoolForTesting() {
  poolOverride = undefined;
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error(
      "DATABASE_URL is required. Use SCOPELEDGER_STORAGE=json only for explicit legacy/demo operation."
    );
  }

  return value;
}

export function getPool() {
  if (poolOverride) return poolOverride;

  if (!global.__scopeLedgerPool) {
    global.__scopeLedgerPool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : undefined
    });
  }

  return global.__scopeLedgerPool;
}

/**
 * Row-level security reads the organization from these settings, and they are
 * set with `is_local = true` so they are discarded when the transaction ends.
 * Without a scope the settings stay empty, every policy fails to match, and a
 * caller that forgot its context reads nothing instead of reading everything.
 */
async function applyTenantContext(client: Pick<PoolClient, "query">) {
  const context = currentTenantContext();

  await client.query("SELECT set_config('app.organization_id', $1, true), set_config('app.system_access', $2, true)", [
    context?.organizationId ?? "",
    context?.systemAccess ? "on" : ""
  ]);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return transaction((client) => client.query<T>(text, [...values]));
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await applyTenantContext(client);
    const result = await work(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (global.__scopeLedgerPool) {
    await global.__scopeLedgerPool.end();
    global.__scopeLedgerPool = undefined;
  }
}
