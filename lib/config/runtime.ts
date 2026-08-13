import { CATALOG_PROVIDER_NAMES, PROVIDER_CATALOG, isCatalogProvider, missingEnvironmentFor } from "@/lib/ai/catalog";

export type RuntimeEnvironment = Record<string, string | undefined>;

/**
 * Test-only code paths disable authentication and origin checks, so a stray
 * NODE_ENV=test on a server would expose the whole API. Requiring the runner's
 * own marker as well means the bypass cannot engage outside `vitest`.
 */
export function isTestRuntime(env: RuntimeEnvironment = process.env) {
  return env.NODE_ENV === "test" && Boolean(env.VITEST);
}

/**
 * `Redis.fromEnv` reads either pair, the KV_ names being what the Vercel
 * marketplace injects. A gate recognising only one of them would report an
 * installation as unprotected while the client it guards connected perfectly
 * well.
 */
export function isDistributedLimiterConfigured(env: RuntimeEnvironment = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL?.trim() || env.KV_REST_API_URL?.trim();
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim() || env.KV_REST_API_TOKEN?.trim();

  return Boolean(url && token);
}

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function positiveInteger(env: RuntimeEnvironment, name: string, errors: string[]) {
  const value = env[name];

  if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1)) {
    errors.push(`${name} must be a positive integer.`);
  }
}

export function validateProductionConfiguration(env: RuntimeEnvironment = process.env) {
  const errors: string[] = [];

  if (env.NODE_ENV === "test") {
    errors.push("NODE_ENV=test disables authentication and origin checks and cannot be used for a commercial production start.");
  }

  if (!env.DATABASE_URL?.trim()) {
    errors.push("DATABASE_URL is required.");
  } else {
    try {
      const database = new URL(env.DATABASE_URL);

      if (!["postgres:", "postgresql:"].includes(database.protocol)) {
        errors.push("DATABASE_URL must use PostgreSQL.");
      }

      if (!database.pathname || database.pathname === "/") errors.push("DATABASE_URL must name a database.");
    } catch {
      errors.push("DATABASE_URL must be a valid PostgreSQL URL.");
    }
  }

  if (env.DATABASE_SSL && !["disable", "require"].includes(env.DATABASE_SSL)) {
    errors.push("DATABASE_SSL must be disable or require.");
  }

  positiveInteger(env, "DATABASE_POOL_SIZE", errors);
  positiveInteger(env, "DATABASE_STARTUP_TIMEOUT_MS", errors);
  positiveInteger(env, "AI_TIMEOUT_MS", errors);
  positiveInteger(env, "AI_MAX_ATTEMPTS", errors);
  positiveInteger(env, "ANALYSIS_JOB_MAX_ATTEMPTS", errors);

  const cronSecret = env.CRON_SECRET?.trim();

  if (!cronSecret) {
    errors.push("CRON_SECRET is required; without it the scheduled drain refuses every caller and an interrupted analysis job is never recovered.");
  } else if (cronSecret.length < 32) {
    errors.push("CRON_SECRET must be at least 32 characters.");
  }

  if (env.SCOPELEDGER_STORAGE === "json") {
    errors.push("SCOPELEDGER_STORAGE=json is not supported for a commercial production start.");
  }

  if (!env.APP_URL?.trim()) {
    errors.push("APP_URL is required for secure links and origin-aware operations.");
  } else {
    try {
      const url = new URL(env.APP_URL);

      if (!["http:", "https:"].includes(url.protocol)) errors.push("APP_URL must use HTTP or HTTPS.");

      if (url.protocol === "http:" && !isLoopback(url.hostname)) {
        errors.push("APP_URL must use HTTPS unless the installation is bound to loopback.");
      }

      if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
        errors.push("APP_URL must be an origin without credentials, a path, query parameters, or a fragment.");
      }
    } catch {
      errors.push("APP_URL must be a valid absolute URL.");
    }
  }

  if (!env.SCOPELEDGER_MASTER_KEY?.trim()) {
    errors.push("SCOPELEDGER_MASTER_KEY is required to protect integration credentials.");
  } else {
    const encoded = env.SCOPELEDGER_MASTER_KEY.trim();
    const decoded = Buffer.from(encoded, "base64");

    if (decoded.length !== 32 || decoded.toString("base64") !== encoded) {
      errors.push("SCOPELEDGER_MASTER_KEY must be canonical base64 for exactly 32 bytes.");
    }
  }

  const previousKey = env.SCOPELEDGER_PREVIOUS_MASTER_KEY?.trim();

  if (previousKey) {
    const decoded = Buffer.from(previousKey, "base64");

    if (decoded.length !== 32 || decoded.toString("base64") !== previousKey) {
      errors.push("SCOPELEDGER_PREVIOUS_MASTER_KEY must be canonical base64 for exactly 32 bytes.");
    }

    if (previousKey === env.SCOPELEDGER_MASTER_KEY?.trim()) {
      errors.push("SCOPELEDGER_PREVIOUS_MASTER_KEY must differ from SCOPELEDGER_MASTER_KEY; it exists to retire an old key.");
    }
  }

  const catalogList = [...CATALOG_PROVIDER_NAMES].sort().join(", ");
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || "anthropic";

  if (provider === "demo") {
    errors.push("AI_PROVIDER=demo is test-only and cannot be used for a commercial production start.");
  } else if (!isCatalogProvider(provider)) {
    errors.push(`AI_PROVIDER must be one of ${catalogList}.`);
  }

  const fallback = env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();

  if (fallback && !isCatalogProvider(fallback)) {
    errors.push(`AI_FALLBACK_PROVIDER must be blank or one of ${catalogList}.`);
  }

  const selectedProviders = [provider, fallback].filter((name): name is string => Boolean(name)).filter(isCatalogProvider);

  for (const name of new Set(selectedProviders)) {
    for (const variable of missingEnvironmentFor(name, env)) {
      errors.push(`${variable} is required when ${PROVIDER_CATALOG[name].displayName} is the provider or fallback.`);
    }
  }

  for (const name of ["ALLOW_PRIVATE_INTEGRATION_HOSTS", "ALLOW_INSECURE_IMAP"]) {
    if (env[name] && !["true", "false"].includes(env[name]!)) {
      errors.push(`${name} must be true or false.`);
    }
  }

  if (!env.BLOB_READ_WRITE_TOKEN?.trim()) {
    errors.push("BLOB_READ_WRITE_TOKEN is required; without it an uploaded SOW original has nowhere to go.");
  }

  if (!isDistributedLimiterConfigured(env)) {
    errors.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required; without them each running instance counts rate limits on its own and the limit an attacker meets is multiplied by however many are warm.");
  }

  return errors;
}

export function assertProductionConfiguration(env: RuntimeEnvironment = process.env) {
  const errors = validateProductionConfiguration(env);

  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join("\n- ")}`);
}
