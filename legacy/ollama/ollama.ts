import { configuredModelFor } from "@/lib/ai/catalog";
import type { AiProvider, AiProviderHealth, AiRawResponse, AiRequest } from "@/lib/ai/types";

const RECOMMENDED_MODEL = "gemma3:12b-it-qat";

function baseUrl() {
  return (process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434").replace(/\/$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (externalSignal?.aborted) controller.abort();

  externalSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abort);
  }
}

function contextWindow() {
  const value = Number(process.env.OLLAMA_NUM_CTX || 8192);

  return Number.isFinite(value) ? Math.min(131_072, Math.max(2_048, Math.trunc(value))) : 8192;
}

export async function listOllamaModels(timeoutMs = 3_000) {
  const response = await fetchWithTimeout(`${baseUrl()}/api/tags`, {}, timeoutMs);

  if (!response.ok) throw new Error(`Ollama model discovery returned ${response.status}.`);

  const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };

  return (payload.models ?? []).map((model) => model.name || model.model || "").filter(Boolean);
}

async function selectedModel() {
  const models = await listOllamaModels();
  const configured = configuredModelFor("ollama");

  if (configured) {
    if (!models.includes(configured)) throw new Error(`Configured Ollama model ${configured} is not installed.`);

    return { model: configured, models };
  }

  if (models.includes(RECOMMENDED_MODEL)) return { model: RECOMMENDED_MODEL, models };

  if (models[0]) return { model: models[0], models };

  throw new Error("Ollama is running but no local models are installed.");
}

export class OllamaProvider implements AiProvider {
  name = "ollama" as const;

  async generate(request: AiRequest): Promise<AiRawResponse> {
    const { model } = await selectedModel();
    const response = await fetchWithTimeout(
      `${baseUrl()}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: request.jsonSchema,
          options: { temperature: 0, num_ctx: contextWindow(), num_predict: request.maxOutputTokens },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt }
          ]
        })
      },
      request.timeoutMs,
      request.signal
    );

    if (!response.ok) throw new Error(`Ollama analysis returned ${response.status}.`);

    const payload = (await response.json()) as { model?: string; message?: { content?: string } };

    if (!payload.message?.content) throw new Error("Ollama returned an empty analysis.");

    return { content: payload.message.content, model: payload.model || model };
  }

  async health(): Promise<AiProviderHealth> {
    const configuredModel = configuredModelFor("ollama");

    try {
      const { model, models } = await selectedModel();

      return {
        provider: this.name,
        available: true,
        configuredModel,
        selectedModel: model,
        models,
        message: `Ollama is ready with ${model}.`
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const message = /^(Configured Ollama model|Ollama is running but no local models|Ollama model discovery returned \d+)/.test(detail)
        ? detail
        : "Ollama could not be reached. Check OLLAMA_BASE_URL, the Ollama service, and the local firewall.";

      return {
        provider: this.name,
        available: false,
        configuredModel,
        selectedModel: null,
        models: [],
        message
      };
    }
  }
}
