import os from "node:os";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { runAutomationCycle } from "../lib/automation/worker";
import { assertProductionConfiguration } from "../lib/config/runtime";
import { closePool } from "../lib/db/client";

function pollMilliseconds() {
  const value = Number(process.env.AUTOMATION_POLL_SECONDS || 15);

  return (Number.isSafeInteger(value) && value >= 5 && value <= 300
    ? value
    : 15) * 1000;
}

const owner = `${os.hostname()}:${process.pid}:${randomUUID()}`;
let stopping = false;

process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

async function main() {
  assertProductionConfiguration();

  while (!stopping) {
    const result = await runAutomationCycle(owner);

    if (!result)
      await new Promise((resolve) => setTimeout(resolve, pollMilliseconds()));
  }

  await closePool();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
