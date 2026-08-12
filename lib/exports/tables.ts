import { query } from "@/lib/db/client";

/**
 * A table is in the export because it carries `organization_id`, not because
 * anyone listed it. A table added later joins without being enrolled by hand,
 * which is the only version of this that stays true.
 *
 * The cost of that is this list: anything a firm must not be handed has to be
 * withheld deliberately, with the reason next to it. `tests/dataExport.test.ts`
 * fails when a table arrives that nobody has decided about.
 */
export const WITHHELD_FROM_EXPORT = new Map<string, string>([
  ["encrypted_secrets", "ciphertext under ScopeLedger's master key: useless to the firm and a target inside a downloaded file"],
  ["oauth_authorization_requests", "in-flight PKCE verifiers for connections still being authorised"],
  ["user_sessions", "live session token hashes; a downloaded copy of one is a credential"]
]);

export async function organizationScopedTables() {
  const tables = await query<{ relname: string }>(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organization_id'
      AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  return tables.rows.map((row) => row.relname);
}

export async function exportableTables() {
  return (await organizationScopedTables()).filter((table) => !WITHHELD_FROM_EXPORT.has(table));
}
