import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A serverless deployment gives the application no writable disk that outlives a
 * response and no PostgreSQL client binaries to spawn. Both were fine for the
 * retired container and are silent data loss here: a file written to a local path
 * disappears with the instance, and a spawn fails at runtime rather than at build.
 *
 * These sweep the source rather than enumerate known offenders, so a dependency
 * reintroduced later is caught without anyone remembering to enrol it.
 */
const ROOT = path.join(process.cwd());
const SWEPT_DIRECTORIES = ["app", "lib", "components"];

async function sourceFiles(directory: string): Promise<string[]> {
  const absolute = path.join(ROOT, directory);
  const entries = await fs.readdir(absolute, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    const relative = path.join(directory, entry.name);

    if (entry.isDirectory()) files.push(...await sourceFiles(relative));
    else if (/\.tsx?$/.test(entry.name)) files.push(relative);
  }

  return files;
}

async function sweptSources() {
  const collected = await Promise.all(SWEPT_DIRECTORIES.map(sourceFiles));

  return Promise.all(collected.flat().map(async (file) => ({
    file,
    text: await fs.readFile(path.join(ROOT, file), "utf8")
  })));
}

/**
 * Reading bundled files is fine — migrations ship inside the deployment. Writing
 * is what does not survive, so the allowance is per module and per reason.
 */
const MAY_TOUCH_THE_FILESYSTEM = new Map<string, string>([
  ["lib/db/migrations.ts", "reads migration SQL that ships inside the bundle"],
  ["lib/store/json/persistence.ts", "the retired JSON store, selected only by SCOPELEDGER_STORAGE=json"]
]);

describe("the application runs without a disk it can write to", () => {
  it("spawns no child process, so it needs no PostgreSQL client binaries", async () => {
    const spawning = (await sweptSources())
      .filter(({ text }) => /from "node:child_process"|require\("child_process"\)/.test(text))
      .map(({ file }) => file);

    expect(spawning).toEqual([]);
  });

  it("writes nothing to a local path outside the modules allowed to", async () => {
    const writing = (await sweptSources())
      .filter(({ file, text }) =>
        !MAY_TOUCH_THE_FILESYSTEM.has(file) &&
        /from "node:fs"|from "node:fs\/promises"/.test(text))
      .map(({ file }) => file);

    expect(writing).toEqual([]);
  });

  it("keeps the filesystem allowance to modules that still exist and still need it", async () => {
    const missing: string[] = [];

    for (const file of MAY_TOUCH_THE_FILESYSTEM.keys()) {
      const exists = await fs.access(path.join(ROOT, file)).then(() => true).catch(() => false);

      if (!exists) missing.push(file);
    }

    expect(missing).toEqual([]);
    expect(MAY_TOUCH_THE_FILESYSTEM.size).toBe(2);
  });

  it("puts the whole-installation backup beyond reach of anything the application serves", async () => {
    const reaching = (await sweptSources())
      .filter(({ text }) => /backups\/native|createInstallationBackup|restoreInstallationBackup/.test(text))
      .map(({ file }) => file);

    expect(reaching).toEqual([]);
  });
});
