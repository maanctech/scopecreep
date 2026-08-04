import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildDemoStore } from "@/lib/demo";
import {
  LocalStoreFormatError,
  migrateStoreShape,
  type BusinessStore
} from "@/lib/migrations/localStore";
import { LocalStoreCorruptError } from "@/lib/storeErrors";

export const dataDir = path.join(process.cwd(), "data");
export const dataFile = path.join(dataDir, "demo-store.json");
let mutationQueue: Promise<void> = Promise.resolve();

export function now() {
  return new Date().toISOString();
}

export function seedStore(): BusinessStore {
  return buildDemoStore() as BusinessStore;
}

export async function backupStoreFile(prefix: string): Promise<string> {
  const backupFile = path.join(dataDir, `demo-store.${prefix}-${Date.now()}.json`);

  await fs.copyFile(dataFile, backupFile);

  return backupFile;
}

/**
 * Reads the local store, migrating older schema versions in place.
 *
 * Policies:
 * - Missing file: seed the fictional demo store (nothing is lost).
 * - Older schema: back up the original file, then persist the migrated copy.
 * - Corrupt or unusable file: back it up and throw a visible error. Real
 *   data is NEVER silently replaced with demo data.
 */
export async function readLocalStore(): Promise<BusinessStore> {
  let raw: string;

  try {
    raw = await fs.readFile(dataFile, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const seed = seedStore();

      await writeLocalStore(seed);

      return seed;
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    const backupFile = await backupStoreFile("corrupt");

    throw new LocalStoreCorruptError(
      `The local data file is not valid JSON. It was backed up to ${backupFile}. Restore it manually or run "npm run seed" to start over with demo data.`
    );
  }

  try {
    const { store, migrated } = migrateStoreShape(parsed);

    if (migrated) {
      await backupStoreFile("pre-migration-backup");
      await writeLocalStore(store);
    }

    return store;
  } catch (error) {
    if (error instanceof LocalStoreFormatError) {
      const backupFile = await backupStoreFile("unreadable");

      throw new LocalStoreCorruptError(
        `The local data file could not be read (${error.message}) It was backed up to ${backupFile}. Restore it manually or run "npm run seed" to start over with demo data.`
      );
    }

    throw error;
  }
}

export async function writeLocalStore(store: BusinessStore) {
  await fs.mkdir(dataDir, { recursive: true });
  const tempFile = path.join(dataDir, `demo-store.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);

  await fs.writeFile(tempFile, JSON.stringify(store, null, 2));
  await fs.rename(tempFile, dataFile);
}

export async function mutateLocalStore<T>(mutator: (store: BusinessStore) => T | Promise<T>) {
  const operation = mutationQueue.then(async () => {
    const store = await readLocalStore();
    const result = await mutator(store);

    await writeLocalStore(store);

    return result;
  });

  mutationQueue = operation.then(
    () => undefined,
    () => undefined
  );

  return operation;
}
