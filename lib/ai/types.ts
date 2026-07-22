import type { AnalysisInput } from "@/lib/types";

export const AI_PROVIDERS = ["ollama", "openai", "demo"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

export type AiRequest = {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
};

export type AiRawResponse = {
  content: string;
  model: string;
};

export interface AiProvider {
  name: AiProviderName;
  generate(request: AiRequest): Promise<AiRawResponse>;
  health(): Promise<AiProviderHealth>;
}

export type AiProviderHealth = {
  provider: AiProviderName;
  available: boolean;
  configuredModel: string | null;
  selectedModel: string | null;
  models: string[];
  message: string;
};

export type AnalysisMetadata = {
  provider: AiProviderName;
  model: string;
  promptVersion: string;
  inputHash: string;
  attempts: number;
  status: "Succeeded" | "Failed";
  errorMessage: string | null;
};

export type DetailedAnalysis = {
  analysis: AnalysisInput;
  metadata: AnalysisMetadata;
};
