type RuntimeEnvironment = Record<string, string | undefined>;

export function validateProductionConfiguration(env: RuntimeEnvironment = process.env) {
  const errors: string[] = [];
  if (!env.DATABASE_URL?.trim()) errors.push("DATABASE_URL is required.");
  if (env.SCOPELEDGER_STORAGE === "json") {
    errors.push("SCOPELEDGER_STORAGE=json is not supported for a commercial production start.");
  }
  if (!env.APP_URL?.trim()) {
    errors.push("APP_URL is required for secure links and origin-aware operations.");
  } else {
    try {
      const url = new URL(env.APP_URL);
      if (!["http:", "https:"].includes(url.protocol)) errors.push("APP_URL must use HTTP or HTTPS.");
    } catch {
      errors.push("APP_URL must be a valid absolute URL.");
    }
  }
  if (env.SCOPELEDGER_MASTER_KEY?.trim()) {
    const encoded = env.SCOPELEDGER_MASTER_KEY.trim();
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.length !== 32 || decoded.toString("base64") !== encoded) {
      errors.push("SCOPELEDGER_MASTER_KEY must be canonical base64 for exactly 32 bytes.");
    }
  }
  return errors;
}

export function assertProductionConfiguration(env: RuntimeEnvironment = process.env) {
  const errors = validateProductionConfiguration(env);
  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join("\n- ")}`);
}
