import { requiredModelFor } from "@/lib/ai/catalog";
import type { AiProvider, AiProviderHealth, AiRawResponse, AiRequest } from "@/lib/ai/types";

export class OpenAiProvider implements AiProvider {
  name = "openai" as const;

  async generate(request: AiRequest): Promise<AiRawResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = requiredModelFor("openai");

    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const controller = new AbortController();
    const abort = () => controller.abort();

    if (request.signal?.aborted) controller.abort();

    request.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: request.maxOutputTokens,
          response_format: { type: "json_schema", json_schema: { name: "scopeledger_response", strict: true, schema: request.jsonSchema } },
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt }
          ]
        })
      });

      if (!response.ok) throw new Error(`OpenAI analysis returned ${response.status}.`);

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;

      if (!content) throw new Error("OpenAI returned an empty analysis.");

      return { content, model };
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
    }
  }

  async health(): Promise<AiProviderHealth> {
    let model = "";
    const unavailable = (message: string): AiProviderHealth => ({
      provider: this.name,
      available: false,
      configuredModel: model || null,
      selectedModel: null,
      models: [],
      message
    });

    try {
      model = requiredModelFor("openai");
      const apiKey = process.env.OPENAI_API_KEY?.trim();

      if (!apiKey) return unavailable("OPENAI_API_KEY is not configured.");

      const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000)
      });

      if (response.status === 401 || response.status === 403) return unavailable("OPENAI_API_KEY was rejected. Check the key and its project permissions.");

      if (response.status === 404) return unavailable(`The configured model ${model} is not available to this API key.`);

      if (!response.ok) return unavailable(`The OpenAI API returned ${response.status}.`);

      return {
        provider: this.name,
        available: true,
        configuredModel: model,
        selectedModel: model,
        models: [model],
        message: `OpenAI is ready with ${model}.`
      };
    } catch {
      return unavailable("The OpenAI API could not be reached. Check network egress and the local firewall.");
    }
  }
}
