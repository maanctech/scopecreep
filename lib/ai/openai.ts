import type { AiProvider, AiProviderHealth, AiRawResponse, AiRequest } from "@/lib/ai/types";

export class OpenAiProvider implements AiProvider {
  name = "openai" as const;

  async generate(request: AiRequest): Promise<AiRawResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_completion_tokens: request.maxOutputTokens || 1200,
          response_format: request.jsonSchema
            ? { type: "json_schema", json_schema: { name: "scopeledger_response", strict: true, schema: request.jsonSchema } }
            : { type: "json_object" },
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
    }
  }

  async health(): Promise<AiProviderHealth> {
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
    const available = Boolean(process.env.OPENAI_API_KEY?.trim());
    return {
      provider: this.name,
      available,
      configuredModel: model,
      selectedModel: available ? model : null,
      models: available ? [model] : [],
      message: available ? `OpenAI is configured with ${model}.` : "OPENAI_API_KEY is not configured."
    };
  }
}
