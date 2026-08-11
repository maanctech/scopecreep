import { randomUUID } from "node:crypto";
import { withAuthenticatedTenant } from "@/lib/auth/scope";
import type { AuthContext } from "@/lib/auth/types";
import { assertPermission } from "@/lib/auth/authorization";
import { query } from "@/lib/db/client";
import { createInstallationBackup } from "@/lib/backups/native";
import { logEvent } from "@/lib/observability/logger";

type BackupRow = {
  id: string;
  status: string;
  storage_path: string | null;
  checksum_sha256: string | null;
  byte_size: string | number | null;
  error_message: string | null;
  backup_version: number;
  manifest: Record<string, unknown>;
  includes_database: boolean;
  includes_documents: boolean;
  includes_encrypted_secrets: boolean;
  created_at: Date;
  completed_at: Date | null;
};

function asBackupAdministrator<T>(work: (auth: AuthContext) => Promise<T>) {
  return withAuthenticatedTenant((auth) => {
    assertPermission(auth.role, "backups:write");

    if (!auth.isSystemAdmin) throw new Error("Installation backups require a system administrator.");

    return work(auth);
  });
}

export async function listBackups() {
  return withAuthenticatedTenant(async (auth) => {
    assertPermission(auth.role, "backups:read");
    const result = await query<BackupRow>(
      `SELECT id,status,storage_path,checksum_sha256,byte_size,error_message,backup_version,manifest,
              includes_database,includes_documents,includes_encrypted_secrets,created_at,completed_at
       FROM backup_records
       WHERE organization_id=$1 AND manifest->>'kind'='scopeledger-installation'
       ORDER BY created_at DESC LIMIT 50`,
      [auth.organizationId]
    );

    return result.rows.map((row) => ({
      ...row,
      byte_size: row.byte_size == null ? null : Number(row.byte_size),
      created_at: row.created_at.toISOString(),
      completed_at: row.completed_at?.toISOString() || null
    }));
  });
}

export async function createBackup() {
  return asBackupAdministrator(async (auth) => {
    const id = randomUUID();

    await query(
      "INSERT INTO backup_records (id,organization_id,status,created_by,manifest) VALUES ($1,$2,'Running',$3,$4::jsonb)",
      [id, auth.organizationId, auth.userId, JSON.stringify({ kind: "scopeledger-installation" })]
    );

    try {
      const backup = await createInstallationBackup();

      await query(
        `UPDATE backup_records SET status='Succeeded',storage_path=$1,checksum_sha256=$2,byte_size=$3,
           manifest=$4::jsonb,includes_database=true,includes_documents=$5,includes_encrypted_secrets=true,completed_at=now()
         WHERE id=$6 AND organization_id=$7`,
        [backup.bundle, backup.sha256, backup.bytes, JSON.stringify(backup.manifest),
         backup.manifest.documents.file !== null || backup.manifest.documents.requiredFiles === 0,
         id, auth.organizationId]
      );
      await query(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'backup.created','backup',$4,$5::jsonb)",
        [randomUUID(), auth.organizationId, auth.userId, id,
         JSON.stringify({ complete: backup.manifest.complete, bytes: backup.bytes, sha256: backup.sha256 })]
      );

      return { id, path: backup.bundle, bytes: backup.bytes, sha256: backup.sha256, complete: backup.manifest.complete };
    } catch (error) {
      logEvent("error", "backup.creation_failed", {
        organizationId: auth.organizationId,
        backupId: id,
        error
      });
      await query(
        "UPDATE backup_records SET status='Failed',error_message=$1,completed_at=now() WHERE id=$2 AND organization_id=$3",
        ["Backup creation failed. Verify PostgreSQL client tools and filesystem permissions.", id, auth.organizationId]
      );
      await query(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource_type,resource_id,metadata) VALUES ($1,$2,$3,'backup.failed','backup',$4,$5::jsonb)",
        [randomUUID(), auth.organizationId, auth.userId, id, JSON.stringify({ reason: "Backup creation failed." })]
      );
      throw error;
    }
  });
}
