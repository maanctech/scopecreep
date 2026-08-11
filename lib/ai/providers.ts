import { z } from "zod";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { CATALOG_PROVIDER_NAMES } from "@/lib/ai/catalog";
import { OllamaProvider } from "@/lib/ai/ollama";
import { OpenAiProvider } from "@/lib/ai/openai";
import { AI_PROVIDERS, type AiProvider, type AiProviderName, type RemoteAiProviderName } from "@/lib/ai/types";

const PROVIDER_FACTORIES: Record<RemoteAiProviderName, () => AiProvider> = {
  anthropic: () => new AnthropicProvider(),
  openai: () => new OpenAiProvider(),
  ollama: () => new OllamaProvider()
};

export function configuredProviderName(): AiProviderName {
  if (process.env.NODE_ENV === "test" && !process.env.AI_PROVIDER) return "demo";

  return z.enum(AI_PROVIDERS).parse(process.env.AI_PROVIDER?.trim().toLowerCase() || "anthropic");
}

export function configuredFallbackProviderName(): AiProviderName | null {
  const value = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();

  return value ? z.enum(CATALOG_PROVIDER_NAMES).parse(value) : null;
}

export function providerFor(name: RemoteAiProviderName): AiProvider {
  return PROVIDER_FACTORIES[name]();
}

export async function configuredProviderHealth() {
  const name = configuredProviderName();

  if (name === "demo") {
    return { provider: name, available: true, configuredModel: "deterministic", selectedModel: "deterministic", models: ["deterministic"], message: "Deterministic demo analyzer is active." } as const;
  }

  return providerFor(name).health();
}
