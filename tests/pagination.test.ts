import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  pageSize,
  sliceAfterCursor
} from "@/lib/store/pagination";

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";

describe("choosing a page size", () => {
  it("caps what a caller asks for, so no request can read an unbounded page", () => {
    expect(pageSize(100_000)).toBe(MAX_PAGE_SIZE);
  });

  it("falls back to the default when nothing was asked for", () => {
    expect(pageSize()).toBe(DEFAULT_PAGE_SIZE);
  });

  it("refuses a size below one rather than returning an empty page forever", () => {
    expect(pageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(pageSize(-5)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("keeps a size a caller is entitled to", () => {
    expect(pageSize(25)).toBe(25);
  });
});

describe("reading a cursor out of a page URL", () => {
  it("round-trips the values a page boundary is made of", () => {
    expect(decodeCursor(encodeCursor({ createdAt: "2026-07-05T00:00:00.000Z", id: FIRST })))
      .toEqual({ createdAt: "2026-07-05T00:00:00.000Z", id: FIRST });
  });

  it("rejects an identifier that is not a uuid, which would otherwise reach the database", () => {
    expect(decodeCursor("2026-07-05T00:00:00.000Z|../../etc/passwd")).toBeNull();
  });

  it("rejects a timestamp that is not a date", () => {
    expect(decodeCursor(`whenever|${FIRST}`)).toBeNull();
  });

  it("rejects a value with no separator at all", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
  });

  it("treats a missing cursor as the first page", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("paging a list already held in memory", () => {
  const rows = [
    { createdAt: "2026-07-05T00:00:00.000Z", id: SECOND },
    { createdAt: "2026-07-05T00:00:00.000Z", id: FIRST },
    { createdAt: "2026-07-04T00:00:00.000Z", id: THIRD }
  ];

  it("reports a cursor only when rows remain beyond the page", () => {
    const page = sliceAfterCursor(rows, (row) => row, { limit: 2 });

    expect(page.rows).toHaveLength(2);
    expect(page.nextCursor).toBe(`2026-07-05T00:00:00.000Z|${FIRST}`);
  });

  it("reports no cursor when the page holds everything left", () => {
    expect(sliceAfterCursor(rows, (row) => row, { limit: 3 }).nextCursor).toBeNull();
  });

  it("breaks a tie on identifier so two rows at the same instant are read once each", () => {
    const page = sliceAfterCursor(rows, (row) => row, {
      limit: 2,
      cursor: `2026-07-05T00:00:00.000Z|${SECOND}`
    });

    expect(page.rows.map((row) => row.id)).toEqual([FIRST, THIRD]);
  });

  it("starts from the top when the cursor cannot be read", () => {
    const page = sliceAfterCursor(rows, (row) => row, { limit: 2, cursor: "tampered" });

    expect(page.rows.map((row) => row.id)).toEqual([SECOND, FIRST]);
  });
});
