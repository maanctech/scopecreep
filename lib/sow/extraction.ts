import path from "node:path";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { MAX_EXTRACTED_CHARACTERS, MAX_SOW_FILE_BYTES } from "@/constants/typescript/sow";
import { safeDocumentFilename } from "@/lib/documents/filename";

export { safeDocumentFilename };
export { MAX_EXTRACTED_CHARACTERS, MAX_SOW_FILE_BYTES };

const ALLOWED_EXTENSIONS = new Set([".txt", ".docx", ".pdf"]);

/**
 * The extension picks the parser, so it has to agree with the bytes. Without
 * this a file named `.docx` can be fed to the zip reader as arbitrary content.
 */
const REQUIRED_FILE_SIGNATURES: Record<string, readonly number[]> = {
  ".pdf": [0x25, 0x50, 0x44, 0x46],
  ".docx": [0x50, 0x4b, 0x03, 0x04]
};

function assertSignatureMatchesExtension(buffer: Buffer, extension: string) {
  const signature = REQUIRED_FILE_SIGNATURES[extension];

  if (!signature) return;

  const matches = signature.every((byte, index) => buffer[index] === byte);

  if (!matches) {
    throw new Error("The file contents do not match its extension. Upload a genuine TXT, DOCX, or PDF file.");
  }
}

export type ExtractedSow = {
  text: string;
  sourceType: "TXT" | "DOCX" | "PDF";
  safeFilename: string;
  mediaType: string;
  warning: string | null;
};

function cleanText(value: string) {
  return value.replace(/\0/g, "").replace(/\r\n/g, "\n").trim();
}

export async function extractSowFile(input: { buffer: Buffer; filename: string; mediaType?: string }): Promise<ExtractedSow> {
  if (!input.buffer.length) throw new Error("The selected document is empty.");

  if (input.buffer.length > MAX_SOW_FILE_BYTES) throw new Error("SOW files must be 10 MB or smaller.");

  const safeFilename = safeDocumentFilename(input.filename);
  const extension = path.extname(safeFilename).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Use a TXT, DOCX, or text-based PDF file.");

  assertSignatureMatchesExtension(input.buffer, extension);
  let text = "";

  if (extension === ".txt") text = input.buffer.toString("utf8");

  if (extension === ".docx") text = (await mammoth.extractRawText({ buffer: input.buffer })).value;

  if (extension === ".pdf") {
    try {
      text = (await extractText(new Uint8Array(input.buffer), { mergePages: true })).text;
    } catch {
      throw new Error("This PDF could not be read safely. Use a valid text-based PDF or paste the SOW text manually.");
    }
  }

  if (text.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("This document contains far more text than a statement of work should. Upload the contract itself.");
  }

  text = cleanText(text);

  if (text.length < 40) {
    const reason = extension === ".pdf"
      ? "This PDF appears scanned or contains too little extractable text. Paste the SOW text manually or configure a local OCR workflow."
      : "The document contains too little readable text. Paste the SOW text manually.";

    throw new Error(reason);
  }

  return {
    text,
    sourceType: extension === ".txt" ? "TXT" : extension === ".docx" ? "DOCX" : "PDF",
    safeFilename,
    mediaType: input.mediaType || (extension === ".pdf" ? "application/pdf" : extension === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain"),
    warning: null
  };
}

export function splitSowSections(content: string) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sections: Array<{ heading: string | null; body: string; ordinal: number }> = [];
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (!body.length && !heading) return;

    sections.push({ heading, body: body.join("\n").trim() || heading || "", ordinal: sections.length });
    body = [];
  };

  for (const line of lines) {
    const isHeading = line.length <= 100 && (/^(\d+(\.\d+)*[.)]?\s+|[A-Z][A-Z\s/&-]{3,}$)/.test(line) || line.endsWith(":"));

    if (isHeading) {
      flush();
      heading = line.replace(/:$/, "");
    } else body.push(line);
  }

  flush();

  return sections.length ? sections : [{ heading: null, body: content.trim(), ordinal: 0 }];
}
