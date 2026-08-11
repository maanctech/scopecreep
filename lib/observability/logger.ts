const REDACTED = "[REDACTED]";

export function redactText(value: string) {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, `$1${REDACTED}@`)
    .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, REDACTED);
}

export function redactLogMetadata(value: unknown, key = ""): unknown {
  if (/password|secret|token|authorization|cookie|api.?key|master.?key|sow|message|content|body|email/i.test(key)) {
    return REDACTED;
  }

  if (value instanceof Error) return { name: value.name, message: redactText(value.message.slice(0, 500)) };

  if (typeof value === "string") return redactText(value);

  if (Array.isArray(value)) return value.map((item) => redactLogMetadata(item));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogMetadata(entryValue, entryKey)
      ])
    );
  }

  return value;
}

export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Record<string, unknown> = {}
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactLogMetadata(metadata) as Record<string, unknown>
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
