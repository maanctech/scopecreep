import { query } from "@/lib/db/client";
import { WITHHELD_FROM_EXPORT, exportableTables } from "@/lib/exports/tables";

export const EXPORT_FORMAT_VERSION = 1;

/**
 * Table names come from the catalogue, never from a caller, and are quoted
 * anyway. Row scoping is the tenant policy's job; the explicit predicate is the
 * second lock, because an export is the one place where being wrong is silent.
 */
function quotedIdentifier(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function buildExportPayload(input: { organizationId: string; organizationName: string; generatedAt: string }) {
  const tableNames = await exportableTables();
  const tables: Record<string, Array<Record<string, unknown>>> = {};
  let rowCount = 0;

  for (const table of tableNames) {
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM ${quotedIdentifier(table)} WHERE organization_id = $1`,
      [input.organizationId]
    );

    tables[table] = rows.rows;
    rowCount += rows.rows.length;
  }

  /**
   * `users` carries no organization_id, so it is not a table the catalogue
   * sweep can reach, and a firm's export would otherwise name its own people
   * only as bare identifiers. The columns are listed rather than selected with
   * `*` because that table also holds the password hash.
   */
  const members = await query<Record<string, unknown>>(
    `SELECT u.id, u.email, u.display_name, u.created_at, m.role, m.created_at AS joined_at
     FROM users u
     JOIN organization_memberships m ON m.user_id = u.id
     WHERE m.organization_id = $1
     ORDER BY u.created_at`,
    [input.organizationId]
  );

  return {
    members: members.rows,
    manifest: {
      kind: "scopeledger-organization-export",
      formatVersion: EXPORT_FORMAT_VERSION,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
      generatedAt: input.generatedAt,
      tableCount: tableNames.length,
      rowCount,
      withheldTables: [...WITHHELD_FROM_EXPORT.keys()],
      withheldReasons: Object.fromEntries(WITHHELD_FROM_EXPORT),
      documentOriginals: "Uploaded SOW originals are not inside this file. Download each one from its SOW version while the account is active."
    },
    tables
  };
}
