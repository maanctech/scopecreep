import { del, get, put as putBlob } from "@vercel/blob";
import type { StoredOriginal } from "@/lib/documents/types";

export async function put(pathname: string, bytes: Buffer, mediaType: string) {
  const result = await putBlob(pathname, bytes, {
    access: "private",
    contentType: mediaType,
    addRandomSuffix: false,
    allowOverwrite: false
  });

  return result.pathname;
}

export async function read(pathname: string): Promise<StoredOriginal | null> {
  const result = await get(pathname, { access: "private" });

  if (!result || result.statusCode !== 200) return null;

  return {
    stream: result.stream,
    mediaType: result.blob.contentType || "application/octet-stream",
    byteSize: result.blob.size
  };
}

export async function remove(pathname: string) {
  await del(pathname);
}
