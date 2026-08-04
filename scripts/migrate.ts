import { closePool } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrations";

async function main() {
  try {
    const applied = await runMigrations();

    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
  } finally {
    await closePool();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
