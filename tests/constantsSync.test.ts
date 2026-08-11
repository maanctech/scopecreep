import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONSTANTS_ROOT, readConstantSources, renderConstantModules } from "@/scripts/generate-constants";
import { PERMISSIONS } from "@/constants/typescript/auth";
import { CLASSIFICATIONS, WORKFLOW_STATUSES } from "@/constants/typescript/domain";
import { FINDING_ACTIONS } from "@/constants/typescript/analysis";
import { BOUNDARY_TYPES } from "@/constants/typescript/sow";

const REGENERATE = "Run `npm run constants:generate` to bring the generated modules back in step with constants/json.";

/**
 * Resolves to `false` when a union has widened to plain `string`. The generated
 * modules only keep their literal unions while the generator emits `as const`,
 * and almost nothing downstream fails loudly when that slips: Zod accepts a
 * `string[]` for `z.enum`, so the call sites compile either way and quietly
 * stop constraining anything.
 */
type IsNarrowUnion<T> = string extends T ? false : true;

const CLASSIFICATIONS_STAY_NARROW: IsNarrowUnion<(typeof CLASSIFICATIONS)[number]> = true;
const WORKFLOW_STATUSES_STAY_NARROW: IsNarrowUnion<(typeof WORKFLOW_STATUSES)[number]> = true;
const PERMISSIONS_STAY_NARROW: IsNarrowUnion<(typeof PERMISSIONS)[number]> = true;
const FINDING_ACTIONS_STAY_NARROW: IsNarrowUnion<(typeof FINDING_ACTIONS)[number]> = true;
const BOUNDARY_TYPES_STAY_NARROW: IsNarrowUnion<(typeof BOUNDARY_TYPES)[number]> = true;

describe("generated constant modules stay in step with constants/json", () => {
  const files = renderConstantModules();

  it.each([...files.keys()])("%s matches what the generator produces from the JSON ground truth", (relativePath) => {
    const onDisk = readFileSync(path.join(CONSTANTS_ROOT, relativePath), "utf8");

    expect(onDisk, REGENERATE).toBe(files.get(relativePath));
  });

  it("emits one TypeScript and one JavaScript module for every JSON source, plus an index for each", () => {
    const { moduleNames } = readConstantSources();

    expect([...files.keys()].sort()).toEqual([
      ...moduleNames.map((name) => path.join("javascript", `${name}.mjs`)),
      path.join("javascript", "index.mjs"),
      ...moduleNames.map((name) => path.join("typescript", `${name}.ts`)),
      path.join("typescript", "index.ts")
    ].sort());
  });

  it("keeps every derived union literal rather than widening it to string", () => {
    expect([
      CLASSIFICATIONS_STAY_NARROW,
      WORKFLOW_STATUSES_STAY_NARROW,
      PERMISSIONS_STAY_NARROW,
      FINDING_ACTIONS_STAY_NARROW,
      BOUNDARY_TYPES_STAY_NARROW
    ]).toEqual([true, true, true, true, true]);
  });

  it.each(readConstantSources().moduleNames.map((name) => path.join("typescript", `${name}.ts`)))(
    "%s marks each of its enumerations `as const`",
    (relativePath) => {
      const rendered = files.get(relativePath) ?? "";
      const declarations = rendered.match(/^export const \w+ = [[{]/gm) ?? [];

      expect(rendered.match(/ as const;$/gm) ?? []).toHaveLength(declarations.length);
    }
  );

  it("omits `as const` from the JavaScript modules, which have no type system to preserve", () => {
    const domain = files.get(path.join("javascript", "domain.mjs"));

    expect(domain).not.toContain("as const");
  });
});
