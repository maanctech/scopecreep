import Anthropic from "@anthropic-ai/sdk";
import { requiredModelFor } from "@/lib/ai/catalog";
import type { AiProvider, AiProviderHealth, AiRawResponse, AiRequest } from "@/lib/ai/types";

const MISSING_KEY_MESSAGE = "ANTHROPIC_API_KEY is not configured.";

function selectedModel() {
  return requiredModelFor("anthropic");
}

function clientFor(timeoutMs: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) throw new Error(MISSING_KEY_MESSAGE);

  return new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 });
}

function failureMessage(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY was rejected. Check the key and its workspace permissions.";

  if (error instanceof Anthropic.PermissionDeniedError) return "The Anthropic API key does not have access to the configured model.";

  if (error instanceof Anthropic.NotFoundError) return `The configured model ${selectedModel()} is not available to this API key.`;

  if (error instanceof Anthropic.RateLimitError) return "The Anthropic API rate limit was reached. Retry shortly or raise the workspace limit.";

  if (error instanceof Anthropic.APIError) return `The Anthropic API returned ${error.status}.`;

  if (error instanceof Error && error.message === MISSING_KEY_MESSAGE) return error.message;

  return "The Anthropic API could not be reached. Check network egress and ANTHROPIC_BASE_URL.";
}

export class AnthropicProvider implements AiProvider {
  name = "anthropic" as const;

  async generate(request: AiRequest): Promise<AiRawResponse> {
    const model = selectedModel();
    const message = await clientFor(request.timeoutMs).messages.create(
      {
        model,
        max_tokens: request.maxOutputTokens,
        system: request.systemPrompt,
        output_config: { format: { type: "json_schema", schema: request.jsonSchema } },
        messages: [{ role: "user", content: request.userPrompt }]
      },
      { signal: request.signal }
    );

    if (message.stop_reason === "refusal") throw new Error("The Anthropic API declined to analyze this content.");

    if (message.stop_reason === "max_tokens") throw new Error("The Anthropic analysis was truncated before the JSON was complete.");

    const content = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (!content.trim()) throw new Error("Anthropic returned an empty analysis.");

    return { content, model: message.model || model };
  }

  async health(): Promise<AiProviderHealth> {
    const configuredModel = process.env.ANTHROPIC_MODEL?.trim() || null;
    let model = "";

    try {
      model = selectedModel();
      await clientFor(10_000).models.retrieve(model);

      return {
        provider: this.name,
        available: true,
        configuredModel,
        selectedModel: model,
        models: [model],
        message: `The Anthropic API is ready with ${model}.`
      };
    } catch (error) {
      return {
        provider: this.name,
        available: false,
        configuredModel,
        selectedModel: null,
        models: [],
        message: failureMessage(error)
      };
    }
  }
}
