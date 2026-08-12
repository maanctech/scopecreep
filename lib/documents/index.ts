import { isTestRuntime } from "@/lib/config/runtime";
import { safeDocumentFilename } from "@/lib/documents/filename";
import * as memoryStore from "@/lib/documents/memory";
import type { OriginalToStore, StoredOriginal } from "@/lib/documents/types";

export const SOW_ORIGINAL_PREFIX = "sow/";
export const EXPORT_ARCHIVE_PREFIX = "exports/";

/**
 * Blob operations are loaded on demand so the test runtime never pulls in a
 * client it has no credentials for, and so a deployment missing the token
 * fails on the first upload with the name of the variable rather than at
 * import time with a stack trace.
 */
async function backend() {
  if (isTestRuntime()) return memoryStore;

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to store or read document originals.");
  }

  return import("@/lib/documents/blob");
}

export function sowOriginalPathname(input: Pick<OriginalToStore, "organizationId" | "projectId" | "versionId" | "filename">) {
  const filename = safeDocumentFilename(input.filename);

  return `${SOW_ORIGINAL_PREFIX}${input.organizationId}/${input.projectId}/${input.versionId}/${filename}`;
}

export async function storeSowOriginal(input: OriginalToStore) {
  const store = await backend();

  return store.put(sowOriginalPathname(input), input.bytes, input.mediaType);
}

export async function readSowOriginal(pathname: string): Promise<StoredOriginal | null> {
  if (!pathname.startsWith(SOW_ORIGINAL_PREFIX)) return null;

  const store = await backend();

  return store.read(pathname);
}

export async function deleteSowOriginal(pathname: string) {
  const store = await backend();

  await store.remove(pathname);
}

export function exportArchivePathname(organizationId: string, exportId: string) {
  return `${EXPORT_ARCHIVE_PREFIX}${organizationId}/${exportId}.json`;
}

export async function storeExportArchive(organizationId: string, exportId: string, bytes: Buffer) {
  const store = await backend();

  return store.put(exportArchivePathname(organizationId, exportId), bytes, "application/json");
}

export async function readExportArchive(pathname: string): Promise<StoredOriginal | null> {
  if (!pathname.startsWith(EXPORT_ARCHIVE_PREFIX)) return null;

  const store = await backend();

  return store.read(pathname);
}
