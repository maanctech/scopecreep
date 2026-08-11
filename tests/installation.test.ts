import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG_PROVIDER_NAMES } from "@/lib/ai/catalog";

const root = process.cwd();
const read = (filename: string) => readFileSync(path.join(root, filename), "utf8");
const dockerAvailable = spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0;

/**
 * The Docker install path is retired to `legacy/docker` rather than deleted,
 * so it stays available if self-hosting is revived. Retired is not the same as
 * abandoned: an install path nobody checks stops working silently, and by the
 * time it is wanted again it is no longer a fallback. These assertions keep it
 * honest.
 */
describe("the retired self-hosted installation assets", () => {
  it("builds a non-root runtime with matching PostgreSQL backup tools and health checks", () => {
    const dockerfile = read("legacy/docker/Dockerfile");

    expect(dockerfile).toContain("FROM node:22-bookworm-slim AS runtime");
    expect(dockerfile).toContain("postgresql-client-15");
    expect(dockerfile).toContain("USER scopeledger");
    expect(dockerfile).toContain("/api/health");
    expect(dockerfile).not.toMatch(/COPY\s+(?:\.\s+\.|data|backups)/);
  });

  /**
   * A directory that the source imports but the Dockerfile never copies fails
   * only inside the image, which nothing in this suite otherwise builds. The
   * `constants/` directory was in exactly that state: twenty modules imported
   * it and neither stage copied it, so the image could not build at all.
   */
  it("copies every root directory the source imports into the stage that needs it", () => {
    const [, buildStage, runtimeStage] = read("legacy/docker/Dockerfile").split(/^FROM /m);
    const copies = (stage: string) => stage.match(/^COPY .*$/gm)?.join("\n") ?? "";

    const importedBy = (directories: string[]) => {
      const found = new Set<string>();

      for (const directory of directories) {
        const entries = readdirSync(path.join(root, directory), { recursive: true, encoding: "utf8" });

        for (const entry of entries) {
          const file = path.join(root, directory, entry);

          if (!/\.(ts|tsx)$/.test(entry) || !statSync(file).isFile()) continue;

          for (const match of readFileSync(file, "utf8").matchAll(/from "@\/([a-zA-Z0-9_-]+)/g)) {
            const target = path.join(root, match[1]);

            if (existsSync(target) && statSync(target).isDirectory()) found.add(match[1]);
          }
        }
      }

      return [...found].sort();
    };

    const buildCopies = copies(buildStage);
    const runtimeCopies = copies(runtimeStage);

    expect(importedBy(["app", "components", "lib"]).filter((name) => !buildCopies.includes(`COPY ${name} `))).toEqual([]);
    expect(importedBy(["lib", "scripts"]).filter((name) => !runtimeCopies.includes(` ${name} ./${name}`))).toEqual([]);
    expect(runtimeCopies).toContain("public ./public");
  });

  /**
   * The entrypoint stopped living under `scripts/` when the install path was
   * retired, so `COPY scripts ./scripts` no longer carries it and it needs a
   * line of its own. Nothing else here notices its absence: the image builds
   * every layer and fails only when a container starts.
   */
  it("copies the entrypoint it declares to the path it declares it at", () => {
    const dockerfile = read("legacy/docker/Dockerfile");
    const declared = dockerfile.match(/ENTRYPOINT \[.*"([^"]*docker-entrypoint\.sh)"\]/)?.[1] ?? "";

    expect(declared).toBe("/app/scripts/docker-entrypoint.sh");
    expect(dockerfile).toContain(`docker-entrypoint.sh .${declared.replace("/app", "")}`);
  });

  it("keeps PostgreSQL private, binds the app to loopback by default, and persists required state", () => {
    const compose = read("legacy/docker/compose.yaml");
    const postgresService = compose.split("\n  app:")[0];

    expect(compose).toContain("image: postgres:15-bookworm");
    expect(compose).toContain("${SCOPELEDGER_BIND_ADDRESS:-127.0.0.1}");
    expect(postgresService).not.toContain("\n    ports:");

    for (const volume of [
      "scopeledger_postgres",
      "scopeledger_app_data",
      "scopeledger_backups"
    ]) {
      expect(compose).toContain(volume);
    }

    expect(compose).toContain("no-new-privileges:true");
  });

  /**
   * The default shipped here was `ollama` while every other file said the
   * default was Anthropic, so an operator who never set AI_PROVIDER got an
   * installation that expected a local model on port 11434 and failed at the
   * first analysis. The default has to name a provider the application can
   * actually construct.
   */
  it("defaults to an AI provider the application can select", () => {
    const compose = read("legacy/docker/compose.yaml");
    const fallback = compose.match(/AI_PROVIDER: \$\{AI_PROVIDER:-([a-z]+)\}/)?.[1] ?? "";

    expect(CATALOG_PROVIDER_NAMES).toContain(fallback);
  });

  it("validates configuration and database readiness before migration and startup", () => {
    const entrypoint = read("legacy/docker/docker-entrypoint.sh");
    const configAt = entrypoint.indexOf("npm run config:check");
    const waitAt = entrypoint.indexOf("npm run db:wait");
    const migrateAt = entrypoint.indexOf("npm run db:migrate");
    const execAt = entrypoint.indexOf('exec "$@"');

    expect(configAt).toBeGreaterThan(-1);
    expect(configAt).toBeLessThan(waitAt);
    expect(waitAt).toBeLessThan(migrateAt);
    expect(migrateAt).toBeLessThan(execAt);
  });

  it("ships placeholders and generation commands instead of committed secrets", () => {
    const environment = read("legacy/docker/env.compose.example");

    expect(environment).toContain("POSTGRES_PASSWORD=");
    expect(environment).toContain("SCOPELEDGER_DB_APP_PASSWORD=");
    expect(environment).toContain("SCOPELEDGER_MASTER_KEY=");
    expect(environment).toContain("openssl rand -hex 24");
    expect(environment).toContain("openssl rand -base64 32");
    expect(environment).not.toMatch(/POSTGRES_PASSWORD=\S+/);
    expect(environment).not.toMatch(/SCOPELEDGER_MASTER_KEY=\S+/);
  });

  it.skipIf(!dockerAvailable)("passes Docker Compose configuration validation", () => {
    execFileSync("docker", ["compose", "-f", "legacy/docker/compose.yaml", "config", "--quiet"], {
      cwd: root,
      env: {
        ...process.env,
        POSTGRES_PASSWORD: "test-only-hex-password",
        SCOPELEDGER_DB_APP_PASSWORD: "test-only-app-password",
        SCOPELEDGER_MASTER_KEY: Buffer.alloc(32).toString("base64")
      },
      stdio: "pipe"
    });
  });
});
