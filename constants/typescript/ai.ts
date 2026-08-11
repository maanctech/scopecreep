// Generated from constants/json by `npm run constants:generate`. Do not edit.

export const PROVIDER_NAMES = [
  "anthropic",
  "ollama",
  "openai",
  "demo"
] as const;

export const PROVIDER_CATALOG = {
  anthropic: {
    displayName: "Anthropic",
    defaultModel: "claude-haiku-4-5",
    modelEnvironmentVariable: "ANTHROPIC_MODEL",
    requiredEnvironmentVariables: [
      "ANTHROPIC_API_KEY"
    ],
    runsLocally: false
  },
  openai: {
    displayName: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    modelEnvironmentVariable: "OPENAI_MODEL",
    requiredEnvironmentVariables: [
      "OPENAI_API_KEY"
    ],
    runsLocally: false
  },
  ollama: {
    displayName: "Ollama",
    defaultModel: null,
    modelEnvironmentVariable: "OLLAMA_MODEL",
    requiredEnvironmentVariables: [],
    runsLocally: true
  }
} as const;
