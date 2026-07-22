import { z } from "zod";
import { OllamaProvider } from "@/lib/ai/ollama";
import { OpenAiProvider } from "@/lib/ai/openai";
import { AI_PROVIDERS, type AiProvider, type AiProviderName } from "@/lib/ai/types";

export function configuredProviderName(): AiProviderName {
  if (process.env.NODE_ENV === "test" && !process.env.AI_PROVIDER) return "demo";
  return z.enum(AI_PROVIDERS).parse(process.env.AI_PROVIDER?.trim().toLowerCase() || "ollama");
}

export function configuredFallbackProviderName(): AiProviderName | null {
  const value = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
  return value ? z.enum(["ollama", "openai"]).parse(value) : null;
}

export function providerFor(name: Exclude<AiProviderName, "demo">): AiProvider {
  return name === "ollama" ? new OllamaProvider() : new OpenAiProvider();
}

export async function configuredProviderHealth() {
  const name = configuredProviderName();
  if (name === "demo") {
    return { provider: name, available: true, configuredModel: "deterministic", selectedModel: "deterministic", models: ["deterministic"], message: "Deterministic demo analyzer is active." } as const;
  }
  return providerFor(name).health();
}
