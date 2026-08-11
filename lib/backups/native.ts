import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import packageJson from "@/package.json";
import { query } from "@/lib/db/client";
import { withSystemAccess } from "@/lib/db/tenantContext";
import { loadMigrations } from "@/lib/db/migrations";

/** A backup covers the whole installation, so it is not scoped to one tenant. */
const systemQuery: typeof query = (text, values) => withSystemAccess(() => query(text, values));

export type BackupManifest = {
  kind: "scopeledger-installation";
  backupVersion: 1;
  appVersion: string;
  createdAt: string;
  latestMigration: string;
  complete: boolean;
  database: { file: "database.dump"; bytes: number; sha256: string };
  documents: {
    requiredFiles: number;
    file: "documents.tar.gz" | null;
    format: "directory-contents-v1";
    bytes: number;
    sha256: string | null;
  };
  encryptedSecretsCovered: true;
};

function checksum(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileMetadata(filename: string) {
  const content = await fs.readFile(filename);

  return { bytes: content.length, sha256: checksum(content) };
}

function postgresEnvironment(databaseUrl: string) {
  const url = new URL(databaseUrl);

  if (!url.protocol.startsWith("postgres")) throw new Error("DATABASE_URL must use PostgreSQL.");

  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: process.env.DATABASE_SSL === "require" ? "verify-full" : "disable"
  };
}

async function run(command: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let error = "";

    child.stderr.on("data", (chunk) => { error += String(chunk).slice(0, 4000); });
    child.once("error", (spawnError) => reject(new Error(`${command} could not start: ${spawnError.message}`)));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} failed with exit code ${code}: ${error.trim()}`)));
  });
}

async function output(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4000); });
    child.once("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    child.once("exit", (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} failed with exit code ${code}: ${stderr.trim()}`)));
  });
}

function normalizedArchiveEntry(entry: string) {
  return entry.replace(/^\.\//, "").replace(/\/$/, "");
}

async function validateTarArchive(archive: string, allowedEntries?: Set<string>) {
  const listing = await output("tar", ["-tzf", archive]);

  for (const entry of listing.split("\n").filter(Boolean)) {
    const normalized = normalizedArchiveEntry(entry);

    if (path.isAbsolute(entry) || entry.split("/").includes("..")) {
      throw new Error("Backup archive contains unsafe paths.");
    }

    if (allowedEntries && normalized && !allowedEntries.has(normalized)) {
      throw new Error("Backup archive contains unexpected files.");
    }
  }

  const verbose = await output("tar", ["-tvzf", archive]);

  if (verbose.split("\n").some((line) => /^\s*[lh]/.test(line))) {
    throw new Error("Backup archive contains unsupported links.");
  }
}

function assertManifest(value: unknown): asserts value is BackupManifest {
  const manifest = value as Partial<BackupManifest> | null;
  const hash = /^[a-f0-9]{64}$/;
  const database = manifest?.database;
  const documents = manifest?.documents;

  if (
    !manifest || manifest.kind !== "scopeledger-installation" ||
    manifest.backupVersion !== 1 || manifest.complete !== true ||
    database?.file !== "database.dump" || !Number.isSafeInteger(database.bytes) || database.bytes! < 0 ||
    !hash.test(database.sha256 || "") || documents?.format !== "directory-contents-v1" ||
    !Number.isSafeInteger(documents.requiredFiles) || documents.requiredFiles! < 0 ||
    !Number.isSafeInteger(documents.bytes) || documents.bytes! < 0 ||
    (documents.file !== null && documents.file !== "documents.tar.gz") ||
    (documents.file === null
      ? documents.bytes !== 0 || documents.sha256 !== null || documents.requiredFiles !== 0
      : !hash.test(documents.sha256 || "")) ||
    manifest.encryptedSecretsCovered !== true
  ) {
    throw new Error("Backup manifest is invalid or uses an unsupported format.");
  }
}

async function requiredDocumentFiles(root: string) {
  const records = await systemQuery<{ storage_path: string }>(
    `SELECT storage_path FROM sow_versions WHERE storage_path IS NOT NULL
     UNION ALL
     SELECT storage_path FROM communication_attachments WHERE storage_path IS NOT NULL`
  );
  const realRoot = records.rows.length ? await fs.realpath(root) : root;

  for (const record of records.rows) {
    const filename = path.resolve(root, record.storage_path);

    if (filename !== root && !filename.startsWith(`${root}${path.sep}`)) {
      throw new Error("A stored document path is outside SCOPELEDGER_DOCUMENT_DIR.");
    }

    const stat = await fs.lstat(filename).catch(() => null);

    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error("A document referenced by the database is missing or is an unsupported link.");
    }

    const realFile = await fs.realpath(filename);

    if (!realFile.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error("A stored document resolves outside SCOPELEDGER_DOCUMENT_DIR.");
    }
  }

  return records.rows.length;
}

export function backupRoot() {
  return path.resolve(process.env.SCOPELEDGER_BACKUP_DIR?.trim() || path.join(process.cwd(), "backups"));
}

export async function createInstallationBackup() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) throw new Error("DATABASE_URL is required for backup creation.");

  const root = backupRoot();

  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const name = `scopeledger-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const working = path.join(root, name);
  const bundle = path.join(root, `${name}.tar.gz`);

  await fs.mkdir(working, { mode: 0o700 });

  try {
    const documentsDirectory = path.resolve(
      process.env.SCOPELEDGER_DOCUMENT_DIR?.trim() || path.join(process.cwd(), "data", "documents")
    );

    if (
      root === documentsDirectory ||
      root.startsWith(`${documentsDirectory}${path.sep}`) ||
      documentsDirectory.startsWith(`${root}${path.sep}`)
    ) {
      throw new Error("SCOPELEDGER_BACKUP_DIR and SCOPELEDGER_DOCUMENT_DIR must not overlap.");
    }

    const dumpFile = path.join(working, "database.dump");
    const pgDump = process.env.PG_DUMP_PATH?.trim() || "pg_dump";

    await run(pgDump, ["--format=custom", "--no-owner", `--file=${dumpFile}`], postgresEnvironment(databaseUrl));
    const database = await fileMetadata(dumpFile);

    const requiredFiles = await requiredDocumentFiles(documentsDirectory);
    let documentFile: string | null = null;
    let documentMetadata = { bytes: 0, sha256: null as string | null };
    const documentStat = await fs.stat(documentsDirectory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;

      throw error;
    });

    if (documentStat?.isDirectory()) {
      documentFile = path.join(working, "documents.tar.gz");
      await run("tar", ["-czf", documentFile, "-C", documentsDirectory, "."]);
      await validateTarArchive(documentFile);
      documentMetadata = await fileMetadata(documentFile);
    }

    const migrations = await loadMigrations();
    const manifest: BackupManifest = {
      kind: "scopeledger-installation",
      backupVersion: 1,
      appVersion: packageJson.version,
      createdAt: new Date().toISOString(),
      latestMigration: migrations.at(-1)?.filename || "none",
      complete: Boolean(database.sha256 && (documentFile || requiredFiles === 0)),
      database: { file: "database.dump", ...database },
      documents: {
        requiredFiles,
        file: documentFile ? "documents.tar.gz" : null,
        format: "directory-contents-v1",
        ...documentMetadata
      },
      encryptedSecretsCovered: true
    };

    if (!manifest.complete) {
      throw new Error("Backup is incomplete because required document files are not available.");
    }

    await fs.writeFile(path.join(working, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    await run("tar", ["-czf", bundle, "-C", working, "."]);
    const bundleMetadata = await fileMetadata(bundle);

    return { bundle, manifest, ...bundleMetadata };
  } catch (error) {
    await fs.rm(bundle, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(working, { recursive: true, force: true });
  }
}

export async function inspectBackupBundle(bundle: string) {
  const source = path.resolve(bundle);
  const temporary = path.join(backupRoot(), `.restore-${randomUUID()}`);

  await fs.mkdir(temporary, { recursive: true, mode: 0o700 });

  try {
    await validateTarArchive(source, new Set(["manifest.json", "database.dump", "documents.tar.gz"]));
    await run("tar", ["-xzf", source, "-C", temporary]);
    const parsed = JSON.parse(await fs.readFile(path.join(temporary, "manifest.json"), "utf8")) as unknown;

    assertManifest(parsed);
    const manifest = parsed;
    const databaseFile = path.join(temporary, manifest.database.file);
    const database = await fileMetadata(databaseFile);

    if (database.sha256 !== manifest.database.sha256 || database.bytes !== manifest.database.bytes) {
      throw new Error("Database backup checksum validation failed.");
    }

    let documentsFile: string | null = null;

    if (manifest.documents.file) {
      documentsFile = path.join(temporary, manifest.documents.file);
      const documents = await fileMetadata(documentsFile);

      if (documents.sha256 !== manifest.documents.sha256 || documents.bytes !== manifest.documents.bytes) {
        throw new Error("Document backup checksum validation failed.");
      }

      await validateTarArchive(documentsFile);
    }

    const migrations = await loadMigrations();

    if (!migrations.some((migration) => migration.filename === manifest.latestMigration)) {
      throw new Error(`This installation does not support backup migration ${manifest.latestMigration}.`);
    }

    return { temporary, manifest, databaseFile, documentsFile };
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function restoreDocuments(archive: string, documentDirectory: string) {
  const parent = path.dirname(documentDirectory);
  const incoming = `${documentDirectory}.restore-${randomUUID()}`;
  const previous = `${documentDirectory}.pre-restore-${randomUUID()}`;

  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  await fs.mkdir(incoming, { mode: 0o700 });
  const hadPrevious = Boolean(await fs.stat(documentDirectory).catch(() => null));

  try {
    await run("tar", ["-xzf", archive, "-C", incoming]);

    if (hadPrevious) await fs.rename(documentDirectory, previous);

    await fs.rename(incoming, documentDirectory);
    await fs.rm(previous, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(incoming, { recursive: true, force: true });

    if (hadPrevious && await fs.stat(previous).catch(() => null)) {
      await fs.rm(documentDirectory, { recursive: true, force: true });
      await fs.rename(previous, documentDirectory);
    }

    throw error;
  }
}

export async function restoreInstallationBackup(bundle: string) {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) throw new Error("DATABASE_URL is required for restore.");

  const inspected = await inspectBackupBundle(bundle);
  const pgRestore = process.env.PG_RESTORE_PATH?.trim() || "pg_restore";

  try {
    await run(
      pgRestore,
      ["--clean", "--if-exists", "--no-owner", `--dbname=${new URL(databaseUrl).pathname.slice(1)}`, inspected.databaseFile],
      postgresEnvironment(databaseUrl)
    );

    if (inspected.documentsFile) {
      const documentDirectory = path.resolve(
        process.env.SCOPELEDGER_DOCUMENT_DIR?.trim() || path.join(process.cwd(), "data", "documents")
      );

      await restoreDocuments(inspected.documentsFile, documentDirectory);
    }

    return inspected.manifest;
  } finally {
    await fs.rm(inspected.temporary, { recursive: true, force: true });
  }
}
