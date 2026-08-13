export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type Page<T> = { rows: T[]; nextCursor: string | null };

export type PageRequest = { limit?: number; cursor?: string | null };

export type Cursor = { createdAt: string; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID.test(value);
}

export function pageSize(requested?: number) {
  if (!requested || !Number.isFinite(requested) || requested < 1) return DEFAULT_PAGE_SIZE;

  return Math.min(Math.trunc(requested), MAX_PAGE_SIZE);
}

export function encodeCursor(cursor: Cursor) {
  return `${cursor.createdAt}|${cursor.id}`;
}

/**
 * A cursor rides in the page URL, where anyone can retype it. An unreadable one
 * means the first page rather than a failed request, and the identifier is
 * checked before it reaches a uuid parameter so a hand-edited link cannot turn
 * into a database error.
 */
export function decodeCursor(raw?: string | null): Cursor | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf("|");

  if (separator < 1) return null;

  const createdAt = raw.slice(0, separator);
  const id = raw.slice(separator + 1);

  if (!UUID.test(id) || Number.isNaN(Date.parse(createdAt))) return null;

  return { createdAt, id };
}

function isBeforeCursor(anchor: Cursor, cursor: Cursor) {
  if (anchor.createdAt !== cursor.createdAt) return anchor.createdAt < cursor.createdAt;

  return anchor.id < cursor.id;
}

/**
 * The in-memory counterpart of the keyset query, so the retired JSON store
 * pages by the same cursor values the database does rather than by an index
 * into a list it happens to be holding.
 */
export function sliceAfterCursor<T>(rows: T[], anchor: (row: T) => Cursor, request: PageRequest): Page<T> {
  const limit = pageSize(request.limit);
  const cursor = decodeCursor(request.cursor);
  const remaining = cursor ? rows.filter((row) => isBeforeCursor(anchor(row), cursor)) : rows;
  const page = remaining.slice(0, limit);
  const last = page[page.length - 1];

  return {
    rows: page,
    nextCursor: remaining.length > limit && last ? encodeCursor(anchor(last)) : null
  };
}

export function toPage<T extends { created_at: string; id: string }>(
  rows: T[],
  limit: number
): Page<T> {
  if (rows.length <= limit) return { rows, nextCursor: null };

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  return { rows: page, nextCursor: encodeCursor({ createdAt: last.created_at, id: last.id }) };
}
