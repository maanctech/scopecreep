import type { AiProviderName } from "@/lib/ai/types";

export const ANALYSIS_MAX_OUTPUT_TOKENS = 1200;
const CONTEXT_SAFETY_TOKENS = 1024;
const DEFAULT_CONTEXT_TOKENS = 32768;

function positiveContextSize(value: string | undefined, name: string) {
  const parsed = Number(value || DEFAULT_CONTEXT_TOKENS);

  if (!Number.isSafeInteger(parsed) || parsed < 4096)
    throw new Error(`${name} must be an integer of at least 4096.`);

  return parsed;
}

export function ollamaContextTokens() {
  return positiveContextSize(process.env.OLLAMA_NUM_CTX, "OLLAMA_NUM_CTX");
}

export function assertPromptFitsContext(input: {
  provider: Exclude<AiProviderName, "demo">;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}) {
  const contextTokens =
    input.provider === "ollama"
      ? ollamaContextTokens()
      : DEFAULT_CONTEXT_TOKENS;
  const estimatedInputTokens = Math.ceil(
    (input.systemPrompt.length + input.userPrompt.length) / 3,
  );
  const outputTokens = input.maxOutputTokens || ANALYSIS_MAX_OUTPUT_TOKENS;

  if (
    estimatedInputTokens + outputTokens + CONTEXT_SAFETY_TOKENS >
    contextTokens
  )
    throw new Error(
      `AI prompt exceeds the configured ${contextTokens.toLocaleString()}-token context window. Reduce the SOW, boundary map, or message size before retrying; no evidence was truncated.`,
    );
}
