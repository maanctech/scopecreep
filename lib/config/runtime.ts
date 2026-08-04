import path from "node:path";

type RuntimeEnvironment = Record<string, string | undefined>;

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

  const provider = env.AI_PROVIDER?.trim().toLowerCase() || "ollama";

  if (provider === "demo") {
    errors.push("AI_PROVIDER=demo is test-only and cannot be used for a commercial production start.");
  } else if (!["ollama", "openai"].includes(provider)) {
    errors.push("AI_PROVIDER must be ollama or openai.");
  }

  const fallback = env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();

  if (fallback && !["ollama", "openai"].includes(fallback)) {
    errors.push("AI_FALLBACK_PROVIDER must be blank, ollama, or openai.");
  }

  if ((provider === "openai" || fallback === "openai") && !env.OPENAI_API_KEY?.trim()) {
    errors.push("OPENAI_API_KEY is required when OpenAI is the provider or fallback.");
  }

  if (env.OLLAMA_BASE_URL) {
    try {
      const ollama = new URL(env.OLLAMA_BASE_URL);

      if (!["http:", "https:"].includes(ollama.protocol)) errors.push("OLLAMA_BASE_URL must use HTTP or HTTPS.");

      if (ollama.username || ollama.password || ollama.search || ollama.hash) {
        errors.push("OLLAMA_BASE_URL must not contain credentials, query parameters, or a fragment.");
      }
    } catch {
      errors.push("OLLAMA_BASE_URL must be a valid absolute URL.");
    }
  }

  for (const name of ["ALLOW_PRIVATE_INTEGRATION_HOSTS", "ALLOW_INSECURE_IMAP"]) {
    if (env[name] && !["true", "false"].includes(env[name]!)) {
      errors.push(`${name} must be true or false.`);
    }
  }

  const documents = path.resolve(env.SCOPELEDGER_DOCUMENT_DIR?.trim() || path.join(process.cwd(), "data", "documents"));
  const backups = path.resolve(env.SCOPELEDGER_BACKUP_DIR?.trim() || path.join(process.cwd(), "backups"));

  if (
    documents === backups || documents.startsWith(`${backups}${path.sep}`) ||
    backups.startsWith(`${documents}${path.sep}`)
  ) {
    errors.push("SCOPELEDGER_DOCUMENT_DIR and SCOPELEDGER_BACKUP_DIR must not overlap.");
  }

  return errors;
}

export function assertProductionConfiguration(env: RuntimeEnvironment = process.env) {
  const errors = validateProductionConfiguration(env);

  if (errors.length) throw new Error(`Production configuration is invalid:\n- ${errors.join("\n- ")}`);
}
