export type StoredOriginal = {
  stream: ReadableStream<Uint8Array>;
  mediaType: string;
  byteSize: number;
};

export type OriginalToStore = {
  organizationId: string;
  projectId: string;
  versionId: string;
  filename: string;
  mediaType: string;
  bytes: Buffer;
};
