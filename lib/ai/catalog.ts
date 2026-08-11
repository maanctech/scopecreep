import { PROVIDER_CATALOG as GENERATED_PROVIDER_CATALOG } from "@/constants/typescript/ai";
import type { AiProviderName, RemoteAiProviderName } from "@/lib/ai/types";

export type ProviderCatalogEntry = {
  displayName: string;
  defaultModel: string | null;
  modelEnvironmentVariable: string;
  requiredEnvironmentVariables: readonly string[];
  runsLocally: boolean;
};

export const PROVIDER_CATALOG: Record<RemoteAiProviderName, ProviderCatalogEntry> = GENERATED_PROVIDER_CATALOG;

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
