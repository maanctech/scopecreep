/**
 * Retired with the installation backup itself. The application no longer reaches
 * `createInstallationBackup`, which `tests/serverlessBoundaries.test.ts` enforces,
 * and this file is excluded from the type checker and the linter along with the
 * rest of `legacy/`. It is kept so the bundle format, checksum validation, and
 * restore path are not lost if a single-tenant deployment ever needs them again.
 *
 * See legacy/README.md for what reviving it would take.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  createInstallationBackup,
  inspectBackupBundle,
  restoreInstallationBackup,
  type BackupManifest
} from "./native";

const run = promisify(execFile);
const temporaryDirectories: string[] = [];
const originalBackupDirectory = process.env.SCOPELEDGER_BACKUP_DIR;
const originalDocumentDirectory = process.env.SCOPELEDGER_DOCUMENT_DIR;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPgRestorePath = process.env.PG_RESTORE_PATH;

afterEach(async () => {
  if (originalBackupDirectory === undefined) delete process.env.SCOPELEDGER_BACKUP_DIR;
  else process.env.SCOPELEDGER_BACKUP_DIR = originalBackupDirectory;

  if (originalDocumentDirectory === undefined) delete process.env.SCOPELEDGER_DOCUMENT_DIR;
  else process.env.SCOPELEDGER_DOCUMENT_DIR = originalDocumentDirectory;

  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;

  if (originalPgRestorePath === undefined) delete process.env.PG_RESTORE_PATH;
  else process.env.PG_RESTORE_PATH = originalPgRestorePath;

  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("backup integrity", () => {
  it("rejects overlapping backup and private-document directories without leaving partial work", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "scopeledger-overlap-test-"));

    temporaryDirectories.push(root);
    process.env.SCOPELEDGER_BACKUP_DIR = root;
    process.env.SCOPELEDGER_DOCUMENT_DIR = root;
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/scopeledger";
    await expect(createInstallationBackup()).rejects.toThrow(/must not overlap/);
    expect((await fs.readdir(root)).filter((entry) => entry.startsWith("scopeledger-"))).toEqual([]);
  });

  it("validates database and document checksums before restore", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "scopeledger-backup-test-"));

    temporaryDirectories.push(root);
    process.env.SCOPELEDGER_BACKUP_DIR = root;
    const source = path.join(root, "source");

    await fs.mkdir(source);
    const database = Buffer.from("fictional database dump");
    const documentSource = path.join(root, "documents");

    await fs.mkdir(documentSource);
    await fs.writeFile(path.join(documentSource, "fictional-sow.txt"), "fictional document");
    await run("tar", ["-czf", path.join(source, "documents.tar.gz"), "-C", documentSource, "."]);
    const documents = await fs.readFile(path.join(source, "documents.tar.gz"));

    await fs.writeFile(path.join(source, "database.dump"), database);
    const manifest: BackupManifest = {
      kind: "scopeledger-installation",
      backupVersion: 1,
      appVersion: "0.1.0",
      createdAt: "2026-07-22T00:00:00.000Z",
      latestMigration: "008_reports_operations_security.sql",
      complete: true,
      database: {
        file: "database.dump",
        bytes: database.length,
        sha256: createHash("sha256").update(database).digest("hex")
      },
      documents: {
        requiredFiles: 1,
        file: "documents.tar.gz",
        format: "directory-contents-v1",
        bytes: documents.length,
        sha256: createHash("sha256").update(documents).digest("hex")
      },
      encryptedSecretsCovered: true
    };

    await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));
    const bundle = path.join(root, "verified.tar.gz");

    await run("tar", ["-czf", bundle, "-C", source, "."]);

    const inspected = await inspectBackupBundle(bundle);

    expect(inspected.manifest.complete).toBe(true);
    await fs.rm(inspected.temporary, { recursive: true, force: true });

    const restoreTool = path.join(root, "mock-pg-restore.sh");
    const restoredDocuments = path.join(root, "restored-documents");

    await fs.writeFile(restoreTool, "#!/bin/sh\nexit 0\n", { mode: 0o700 });
    await fs.mkdir(restoredDocuments);
    await fs.writeFile(path.join(restoredDocuments, "old-private-file.txt"), "previous install");
    process.env.DATABASE_URL = "postgresql://user:password@127.0.0.1:5432/scopeledger";
    process.env.PG_RESTORE_PATH = restoreTool;
    process.env.SCOPELEDGER_DOCUMENT_DIR = restoredDocuments;
    const restored = await restoreInstallationBackup(bundle);

    expect(restored.createdAt).toBe(manifest.createdAt);
    await expect(fs.readFile(path.join(restoredDocuments, "fictional-sow.txt"), "utf8"))
      .resolves.toBe("fictional document");
    await expect(fs.stat(path.join(restoredDocuments, "old-private-file.txt"))).rejects.toThrow();

    await fs.writeFile(path.join(source, "database.dump"), "tampered");
    await run("tar", ["-czf", bundle, "-C", source, "."]);
    await expect(inspectBackupBundle(bundle)).rejects.toThrow(/checksum validation failed/);
    const leftovers = (await fs.readdir(root)).filter((entry) => entry.startsWith(".restore-"));

    expect(leftovers).toEqual([]);
  });
});
