import { parse } from "csv-parse/sync";
import { z } from "zod";
import { MAX_IMPORT_BYTES, MAX_IMPORT_MESSAGES } from "@/constants/typescript/ingestion";
import type {
  ImportPreview,
  NormalizedCommunication,
} from "@/lib/ingestion/types";

export { MAX_IMPORT_BYTES, MAX_IMPORT_MESSAGES };

const rowSchema = z.looseObject({
    id: z.union([z.string(), z.number()]).optional().nullable(),
    external_id: z.union([z.string(), z.number()]).optional().nullable(),
    thread_id: z.union([z.string(), z.number()]).optional().nullable(),
    sender: z.string().optional().nullable(),
    sender_email: z.string().optional().nullable(),
    recipients: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .nullable(),
    timestamp: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    edited_at: z.string().optional().nullable(),
    subject: z.string().optional().nullable(),
    channel: z.string().optional().nullable(),
    provider: z.string().optional().nullable(),
    transcript_timing: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    message_text: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
  });

function timestamp(
  value: string | null | undefined,
  warnings: string[],
  row: number,
) {
  if (!value?.trim()) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    warnings.push(`Row ${row}: ignored an invalid timestamp.`);

    return null;
  }

  return parsed.toISOString();
}

function normalizeRow(
  value: unknown,
  rowNumber: number,
  warnings: string[],
): NormalizedCommunication | null {
  const parsed = rowSchema.safeParse(value);

  if (!parsed.success) {
    warnings.push(
      `Row ${rowNumber}: skipped because its fields could not be read.`,
    );

    return null;
  }

  const row = parsed.data;
  const text = String(row.message_text ?? row.message ?? row.text ?? "")
    .replace(/\0/g, "")
    .trim();

  if (!text) {
    warnings.push(`Row ${rowNumber}: skipped because message text is empty.`);

    return null;
  }

  if (text.length > 100_000) {
    warnings.push(
      `Row ${rowNumber}: skipped because the message exceeds 100,000 characters.`,
    );

    return null;
  }

  const recipients = Array.isArray(row.recipients)
    ? row.recipients
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
    : String(row.recipients || "")
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    externalId:
      row.external_id != null
        ? String(row.external_id)
        : row.id != null
          ? String(row.id)
          : null,
    externalThreadId: row.thread_id != null ? String(row.thread_id) : null,
    sender: row.sender?.trim() || null,
    senderEmail: row.sender_email?.trim().toLowerCase() || null,
    recipients,
    timestamp: timestamp(row.timestamp || row.date, warnings, rowNumber),
    editedTimestamp: timestamp(row.edited_at, warnings, rowNumber),
    subject: row.subject?.trim() || null,
    text,
    rawMetadata: {
      ...(row.channel ? { channel: row.channel } : {}),
      ...(row.provider ? { provider: row.provider } : {}),
      ...(row.transcript_timing
        ? { transcriptTiming: row.transcript_timing }
        : {}),
    },
  };
}

export function parseManualImport(input: {
  content: string;
  format: "Text" | "CSV" | "JSON" | "Transcript";
}): ImportPreview {
  if (Buffer.byteLength(input.content, "utf8") > MAX_IMPORT_BYTES)
    throw new Error("Imports must be 5 MB or smaller.");

  const warnings: string[] = [];
  let rows: unknown[];

  if (input.format === "Transcript") {
    rows = parseTranscript(input.content);
  } else if (input.format === "Text") {
    rows = input.content.split(/\n\s*---+\s*\n/).map((text) => ({ text }));
  } else if (input.format === "CSV") {
    rows = parse(input.content, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: false,
    }) as unknown[];
  } else {
    const parsed = JSON.parse(input.content) as unknown;

    rows = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed &&
          Array.isArray((parsed as { messages?: unknown }).messages)
        ? (parsed as { messages: unknown[] }).messages
        : [parsed];
  }

  if (rows.length > MAX_IMPORT_MESSAGES)
    throw new Error(
      `Imports may contain at most ${MAX_IMPORT_MESSAGES.toLocaleString()} messages.`,
    );

  const messages = rows
    .map((row, index) => normalizeRow(row, index + 1, warnings))
    .filter((row): row is NormalizedCommunication => Boolean(row));

  if (!messages.length)
    throw new Error("No valid messages were found in the import.");

  return { format: input.format, messages, warnings };
}

function parseTranscript(content: string) {
  const blocks = content
    .replace(/^WEBVTT[^\n]*\n/i, "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const rows: Array<Record<string, unknown>> = [];

  for (const [index, block] of blocks.entries()) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());

    if (/^\d+$/.test(lines[0] || "")) lines.shift();

    const timing = lines[0]?.match(
      /^(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/,
    );

    if (timing) lines.shift();

    const text = lines
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!text) continue;

    const speaker = text.match(/^([^:]{1,100}):\s+(.+)$/);

    rows.push({
      external_id: `transcript-cue-${index + 1}`,
      sender: speaker?.[1] || null,
      text: speaker?.[2] || text,
      transcript_timing: timing?.[0] || null,
    });
  }

  return rows.length ? rows : [{ text: content }];
}
