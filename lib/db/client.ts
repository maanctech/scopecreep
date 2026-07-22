import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __scopeLedgerPool: Pool | undefined;
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

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, [...values]);
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
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
