import { closePool, query } from "../lib/db/client";

let attempts = 0;

async function main() {
  const configuredTimeout = process.env.DATABASE_STARTUP_TIMEOUT_MS || "90000";
  if (!/^\d+$/.test(configuredTimeout) || Number(configuredTimeout) < 1) {
    throw new Error("DATABASE_STARTUP_TIMEOUT_MS must be a positive integer.");
  }
  const timeoutMs = Math.max(1_000, Number(configuredTimeout));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      await query("SELECT 1");
      console.log(`PostgreSQL is ready after ${attempts} check${attempts === 1 ? "" : "s"}.`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, 250 * attempts)));
    }
  }
  throw new Error(`PostgreSQL did not become ready within ${timeoutMs}ms.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "PostgreSQL readiness check failed.");
    process.exitCode = 1;
  })
  .finally(closePool);
