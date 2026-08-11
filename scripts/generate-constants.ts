import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..");

export const CONSTANTS_ROOT = path.join(REPOSITORY_ROOT, "constants");
export const JSON_DIRECTORY = path.join(CONSTANTS_ROOT, "json");

const GENERATED_NOTICE = "// Generated from constants/json by `npm run constants:generate`. Do not edit.";

function constantCase(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function renderKey(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function renderValue(value: unknown, indent: string): string {
  if (value === null) return "null";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  const nested = `${indent}  `;

  if (Array.isArray(value)) {
    if (!value.length) return "[]";

    const items = value.map((item) => `${nested}${renderValue(item, nested)}`);

    return `[\n${items.join(",\n")}\n${indent}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>);

  if (!entries.length) return "{}";

  const fields = entries.map(([key, item]) => `${nested}${renderKey(key)}: ${renderValue(item, nested)}`);

  return `{\n${fields.join(",\n")}\n${indent}}`;
}

function isLiteralGroup(value: unknown) {
  return value !== null && typeof value === "object";
}

function renderModule(source: Record<string, unknown>, immutable: boolean) {
  const declarations = Object.entries(source).map(([key, value]) => {
    const suffix = immutable && isLiteralGroup(value) ? " as const" : "";

    return `export const ${constantCase(key)} = ${renderValue(value, "")}${suffix};`;
  });

  return `${GENERATED_NOTICE}\n\n${declarations.join("\n\n")}\n`;
}

function renderIndex(moduleNames: string[], extension: string) {
  const lines = moduleNames.map((name) => `export * from "./${name}${extension}";`);

  return `${GENERATED_NOTICE}\n\n${lines.join("\n")}\n`;
}

export function readConstantSources() {
  const moduleNames = readdirSync(JSON_DIRECTORY)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.replace(/\.json$/, ""))
    .sort();

  const seen = new Map<string, string>();
  const sources = moduleNames.map((name) => {
    const parsed = JSON.parse(readFileSync(path.join(JSON_DIRECTORY, `${name}.json`), "utf8")) as Record<string, unknown>;

    for (const key of Object.keys(parsed)) {
      const exported = constantCase(key);
      const owner = seen.get(exported);

      if (owner) throw new Error(`${exported} is declared in both ${owner}.json and ${name}.json. Constant names must be unique across the library.`);

      seen.set(exported, name);
    }

    return { name, parsed };
  });

  return { moduleNames, sources };
}

export function renderConstantModules() {
  const { moduleNames, sources } = readConstantSources();
  const files = new Map<string, string>();

  for (const { name, parsed } of sources) {
    files.set(path.join("typescript", `${name}.ts`), renderModule(parsed, true));
    files.set(path.join("javascript", `${name}.mjs`), renderModule(parsed, false));
  }

  files.set(path.join("typescript", "index.ts"), renderIndex(moduleNames, ""));
  files.set(path.join("javascript", "index.mjs"), renderIndex(moduleNames, ".mjs"));

  return files;
}

function main() {
  const files = renderConstantModules();

  for (const [relativePath, contents] of files) {
    const target = path.join(CONSTANTS_ROOT, relativePath);

    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  console.log(`Generated ${files.size} constant modules from ${JSON_DIRECTORY}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
