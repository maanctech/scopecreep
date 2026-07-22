import { parse } from "csv-parse/sync";
import { z } from "zod";
import type {
  ImportPreview,
  NormalizedCommunication,
} from "@/lib/ingestion/types";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_MESSAGES = 5_000;

const rowSchema = z
  .object({
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
    message: z.string().optional().nullable(),
    message_text: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
  })
  .passthrough();

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
    rawMetadata: {},
  };
}

export function parseManualImport(input: {
  content: string;
  format: "Text" | "CSV" | "JSON";
}): ImportPreview {
  if (Buffer.byteLength(input.content, "utf8") > MAX_IMPORT_BYTES)
    throw new Error("Imports must be 5 MB or smaller.");
  const warnings: string[] = [];
  let rows: unknown[];
  if (input.format === "Text") {
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
