import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const OPERATOR_LANGUAGE = [
  { pattern: /npm run/i, name: "a terminal command" },
  { pattern: /data folder|documents directory/i, name: "a directory on a server" },
  { pattern: /\.json\b/i, name: "a file the reader cannot see" },
  { pattern: /terminal|command line|shell/i, name: "a terminal" },
  { pattern: /localhost|127\.0\.0\.1/i, name: "a development address" },
  { pattern: /stack trace|stacktrace/i, name: "a stack trace" },
  { pattern: /postgres|database/i, name: "the storage engine" }
];

async function operatorLanguageIn(path: string) {
  const source = await readFile(path, "utf8");

  return OPERATOR_LANGUAGE.filter((entry) => entry.pattern.test(source)).map((entry) => entry.name);
}

describe("what a customer is told when something breaks", () => {
  it("never names a command, a directory, or a database on the shared failure notice", async () => {
    expect(await operatorLanguageIn("components/ui/FailureNotice.tsx")).toEqual([]);
  });

  it("never names one on the workspace boundary either", async () => {
    expect(await operatorLanguageIn("app/app/error.tsx")).toEqual([]);
  });

  it("never names one on the boundary that catches a failed layout", async () => {
    expect(await operatorLanguageIn("app/global-error.tsx")).toEqual([]);
  });

  it("keeps the exception message off the workspace boundary", async () => {
    expect(await readFile("app/app/error.tsx", "utf8")).not.toMatch(/error\.message/);
  });

  it("keeps the exception message off the layout boundary", async () => {
    expect(await readFile("app/global-error.tsx", "utf8")).not.toMatch(/error\.message/);
  });

  it("renders its own document on the layout boundary, which replaces the root layout", async () => {
    const source = await readFile("app/global-error.tsx", "utf8");

    expect(source).toMatch(/<html/);
    expect(source).toMatch(/<body/);
  });

  it("hands the reference a customer can quote to the notice, on both boundaries", async () => {
    expect(await readFile("app/app/error.tsx", "utf8")).toMatch(/reference=\{error\.digest\}/);
    expect(await readFile("app/global-error.tsx", "utf8")).toMatch(/reference=\{error\.digest\}/);
  });

  it("gives the keyboard a visible focus ring on every control it draws", async () => {
    const source = await readFile("components/ui/FailureNotice.tsx", "utf8");

    expect(source).toMatch(/focus-visible:/);
  });
});
