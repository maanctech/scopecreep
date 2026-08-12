import { afterEach, describe, expect, it } from "vitest";
import { deleteSowOriginal, readSowOriginal, storeSowOriginal } from "@/lib/documents";

const ORGANIZATION = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";

async function bytesOf(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

function anOriginal(overrides: Partial<Parameters<typeof storeSowOriginal>[0]> = {}) {
  return {
    organizationId: ORGANIZATION,
    projectId: PROJECT,
    versionId: VERSION,
    filename: "master-services-agreement.pdf",
    mediaType: "application/pdf",
    bytes: Buffer.from("%PDF-1.4 fictional signed original"),
    ...overrides
  };
}

const vitestMarker = process.env.VITEST;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

afterEach(() => {
  process.env.VITEST = vitestMarker;

  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
});

describe("statement of work originals", () => {
  it("files an original under the organization, project, and version it belongs to", async () => {
    const pathname = await storeSowOriginal(anOriginal());

    expect(pathname).toBe(`sow/${ORGANIZATION}/${PROJECT}/${VERSION}/master-services-agreement.pdf`);
  });

  it("returns the same bytes and media type the original was stored with", async () => {
    const pathname = await storeSowOriginal(anOriginal({ versionId: "33333333-3333-4333-8333-333333333334" }));
    const stored = await readSowOriginal(pathname);

    expect(stored?.mediaType).toBe("application/pdf");
    expect(stored?.byteSize).toBe(34);
    expect(await bytesOf(stored!.stream)).toEqual(Buffer.from("%PDF-1.4 fictional signed original"));
  });

  it("returns nothing for an original that was never stored", async () => {
    expect(await readSowOriginal(`sow/${ORGANIZATION}/${PROJECT}/absent/absent.pdf`)).toBeNull();
  });

  it("removes an original whose version failed to commit", async () => {
    const pathname = await storeSowOriginal(anOriginal({ versionId: "33333333-3333-4333-8333-333333333335" }));

    await deleteSowOriginal(pathname);

    expect(await readSowOriginal(pathname)).toBeNull();
  });

  it("strips a filename that would climb out of the version it belongs to", async () => {
    const pathname = await storeSowOriginal(anOriginal({
      versionId: "33333333-3333-4333-8333-333333333336",
      filename: "../../../etc/passwd"
    }));

    expect(pathname).toBe(`sow/${ORGANIZATION}/${PROJECT}/33333333-3333-4333-8333-333333333336/passwd`);
  });

  it("refuses to store anything when no blob store is configured outside the test runtime", async () => {
    delete process.env.VITEST;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    await expect(storeSowOriginal(anOriginal())).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
