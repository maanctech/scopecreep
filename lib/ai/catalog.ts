import type { AiProviderName, RemoteAiProviderName } from "@/lib/ai/types";

export type ProviderCatalogEntry = {
  displayName: string;
  defaultModel: string | null;
  modelEnvironmentVariable: string;
  requiredEnvironmentVariables: string[];
  runsLocally: boolean;
};

export const PROVIDER_CATALOG: Record<RemoteAiProviderName, ProviderCatalogEntry> = {
  anthropic: {
    displayName: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    modelEnvironmentVariable: "ANTHROPIC_MODEL",
    requiredEnvironmentVariables: ["ANTHROPIC_API_KEY"],
    runsLocally: false
  },
  openai: {
    displayName: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    modelEnvironmentVariable: "OPENAI_MODEL",
    requiredEnvironmentVariables: ["OPENAI_API_KEY"],
    runsLocally: false
  },
  ollama: {
    displayName: "Ollama",
    defaultModel: null,
    modelEnvironmentVariable: "OLLAMA_MODEL",
    requiredEnvironmentVariables: [],
    runsLocally: true
  }
};

export const CATALOG_PROVIDER_NAMES = Object.keys(PROVIDER_CATALOG) as [RemoteAiProviderName, ...RemoteAiProviderName[]];

export function isCatalogProvider(value: string): value is RemoteAiProviderName {
  return Object.hasOwn(PROVIDER_CATALOG, value);
}

export function configuredModelFor(name: RemoteAiProviderName) {
  const entry = PROVIDER_CATALOG[name];

  return process.env[entry.modelEnvironmentVariable]?.trim() || entry.defaultModel;
}

export function requiredModelFor(name: RemoteAiProviderName) {
  const model = configuredModelFor(name);

  if (!model) throw new Error(`Set ${PROVIDER_CATALOG[name].modelEnvironmentVariable} to choose a ${PROVIDER_CATALOG[name].displayName} model.`);

  return model;
}

export function missingEnvironmentFor(name: RemoteAiProviderName, env: Record<string, string | undefined>) {
  return PROVIDER_CATALOG[name].requiredEnvironmentVariables.filter((variable) => !env[variable]?.trim());
}

export function displayModelFor(provider: AiProviderName) {
  if (provider === "demo") return "deterministic";

  return configuredModelFor(provider) || "Automatic model selection";
}
