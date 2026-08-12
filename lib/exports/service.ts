import { createHash, randomUUID } from "node:crypto";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import { query } from "@/lib/db/client";
import { readExportArchive, storeExportArchive } from "@/lib/documents";
import { buildExportPayload } from "@/lib/exports/builder";
import { WITHHELD_FROM_EXPORT } from "@/lib/exports/tables";
import { logEvent } from "@/lib/observability/logger";

export const EXPORT_DOWNLOAD_DAYS = 7;

export type DataExport = {
  id: string;
  status: string;
  byteSize: number | null;
  rowCount: number | null;
  tableCount: number | null;
  withheldTables: string[];
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  completedAt: string | null;
};

type Row = Record<string, unknown>;

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value ? String(value) : null;

function mapExport(row: Row): DataExport {
  return {
    id: String(row.id),
    status: String(row.status),
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
    rowCount: row.row_count === null ? null : Number(row.row_count),
    tableCount: row.table_count === null ? null : Number(row.table_count),
    withheldTables: (row.withheld_tables as string[] | null) || [],
    errorMessage: row.error_message ? String(row.error_message) : null,
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at)
  };
}

export async function listDataExports() {
  return withAuthenticatedTenant(async (auth) => {
    const rows = await query<Row>(
      "SELECT * FROM data_exports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 25",
      [auth.organizationId]
    );

    return rows.rows.map(mapExport);
  });
}

/**
 * The whole export is built in one request rather than left to the drain. It is
 * one organization's rows read through ordinary queries, so the work is bounded
 * by that firm's own data, and a firm asking for its records should not have to
 * wait for a schedule to come round. A build that outruns the request leaves the
 * row Running with its reason recorded, which is visible rather than silent.
 */
export async function requestDataExport() {
  return withAuthenticatedTenant(async (auth) => {
    const exportId = randomUUID();

    await query(
      "INSERT INTO data_exports (id,organization_id,status,requested_by,started_at) VALUES ($1,$2,'Running',$3,now())",
      [exportId, auth.organizationId, auth.userId]
    );

    try {
      const payload = await buildExportPayload({
        organizationId: auth.organizationId,
        organizationName: auth.organizationName,
        generatedAt: new Date().toISOString()
      });
      const bytes = Buffer.from(JSON.stringify(payload, null, 2));
      const storagePath = await storeExportArchive(auth.organizationId, exportId, bytes);

      await query(
        `UPDATE data_exports
         SET status='Succeeded',storage_path=$1,byte_size=$2,content_sha256=$3,table_count=$4,row_count=$5,
             withheld_tables=$6,expires_at=now() + make_interval(days => $7),completed_at=now(),updated_at=now()
         WHERE id=$8 AND organization_id=$9`,
        [storagePath, bytes.length, createHash("sha256").update(bytes).digest("hex"),
         payload.manifest.tableCount, payload.manifest.rowCount, [...WITHHELD_FROM_EXPORT.keys()],
         EXPORT_DOWNLOAD_DAYS, exportId, auth.organizationId]
      );

      await query(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id) VALUES ($1,$2,$3,'export.created','data_export',$4)",
        [randomUUID(), auth.organizationId, auth.userId, exportId]
      );

      return { id: exportId, rowCount: payload.manifest.rowCount, tableCount: payload.manifest.tableCount };
    } catch (error) {
      logEvent("error", "export.failed", { exportId, error });
      await query(
        "UPDATE data_exports SET status='Failed',error_message=$1,completed_at=now(),updated_at=now() WHERE id=$2 AND organization_id=$3",
        ["The export could not be produced. Nothing was written.", exportId, auth.organizationId]
      );

      throw error;
    }
  });
}

export async function downloadDataExport(exportId: string) {
  return withAuthenticatedTenant(async (auth) => {
    const rows = await query<Row>(
      "SELECT * FROM data_exports WHERE id=$1 AND organization_id=$2 AND status='Succeeded' AND expires_at > now()",
      [exportId, auth.organizationId]
    );
    const record = rows.rows[0];

    if (!record?.storage_path) return null;

    const stored = await readExportArchive(String(record.storage_path));

    if (!stored) return null;

    return {
      stream: stored.stream,
      byteSize: stored.byteSize,
      filename: `scopeledger-export-${exportId}.json`
    };
  });
}
