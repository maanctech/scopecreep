import { isTestRuntime } from "@/lib/config/runtime";

export function shouldUsePostgresStorage() {
  if (process.env.SCOPELEDGER_STORAGE === "json") return false;

  if (process.env.SCOPELEDGER_STORAGE === "postgres") return true;

  return !isTestRuntime();
}
