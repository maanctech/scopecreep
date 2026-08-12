import type { StoredOriginal } from "@/lib/documents/types";

const originals = new Map<string, { bytes: Buffer; mediaType: string }>();

export async function put(pathname: string, bytes: Buffer, mediaType: string) {
  originals.set(pathname, { bytes, mediaType });

  return pathname;
}

export async function read(pathname: string): Promise<StoredOriginal | null> {
  const stored = originals.get(pathname);

  if (!stored) return null;

  return {
    stream: new Response(new Uint8Array(stored.bytes)).body as ReadableStream<Uint8Array>,
    mediaType: stored.mediaType,
    byteSize: stored.bytes.length
  };
}

export async function remove(pathname: string) {
  originals.delete(pathname);
}
