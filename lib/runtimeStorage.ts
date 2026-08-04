export function shouldUsePostgresStorage() {
  return process.env.NODE_ENV !== "test" && process.env.SCOPELEDGER_STORAGE !== "json";
}
