import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeClientRequestDetailed } from "@/lib/analysis";
import { AnthropicProvider } from "@/lib/ai/anthropic";
import { CATALOG_PROVIDER_NAMES, configuredModelFor, displayModelFor, missingEnvironmentFor } from "@/lib/ai/catalog";
import { OllamaProvider, listOllamaModels } from "@/lib/ai/ollama";
import { configuredProviderName } from "@/lib/ai/providers";
import { AI_PROVIDERS } from "@/lib/ai/types";

const originalProvider = process.env.AI_PROVIDER;
const originalModel = process.env.OLLAMA_MODEL;
const originalAttempts = process.env.AI_MAX_ATTEMPTS;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalAnthropicModel = process.env.ANTHROPIC_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();

  if (originalProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalProvider;

  if (originalModel === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = originalModel;

  if (originalAttempts === undefined) delete process.env.AI_MAX_ATTEMPTS;
  else process.env.AI_MAX_ATTEMPTS = originalAttempts;

  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;

  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;

  if (originalAnthropicModel === undefined) delete process.env.ANTHROPIC_MODEL;
  else process.env.ANTHROPIC_MODEL = originalAnthropicModel;
});

describe("Ollama provider", () => {
  it("discovers and selects the recommended installed model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      models: [{ name: "other:latest" }, { name: "gemma3:12b-it-qat" }]
    }), { status: 200 })));
    delete process.env.OLLAMA_MODEL;
    await expect(listOllamaModels()).resolves.toEqual(["other:latest", "gemma3:12b-it-qat"]);
    const health = await new OllamaProvider().health();

    expect(health.available).toBe(true);
    expect(health.selectedModel).toBe("gemma3:12b-it-qat");
  });

  it("retries invalid JSON and returns a validated result", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_MAX_ATTEMPTS = "2";
    delete process.env.OLLAMA_MODEL;
    let chatCalls = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "gemma3:12b-it-qat" }] }), { status: 200 });
      }

      chatCalls += 1;
      const content = chatCalls === 1 ? "not json" : JSON.stringify({
        classification: "Out of Scope",
        confidence_score: 0.94,
        reasoning: "The SOW explicitly excludes customer portals.",
        relevant_sow_sections: ["Excluded: customer login portals."],
        request_type: "Engineering",
        estimated_hours: 10,
        estimated_revenue: 1,
        suggested_change_order: "We can scope the portal separately.",
        internal_note: "Explicit exclusion."
      });

      return new Response(JSON.stringify({ model: "gemma3:12b-it-qat", message: { content } }), { status: 200 });
    }));

    const result = await analyzeClientRequestDetailed({
      sowText: "Excluded: customer login portals.",
      messageText: "Can you add a customer portal?",
      hourlyRate: 175
    });

    expect(result.metadata.status).toBe("Succeeded");
    expect(result.metadata.attempts).toBe(2);
    expect(result.analysis.estimated_revenue).toBe(1750);
  });

  it("retries a definitive out-of-scope response with zero effort", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_MAX_ATTEMPTS = "2";
    process.env.OLLAMA_MODEL = "gemma3:12b-it-qat";
    let chatCalls = 0;

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "gemma3:12b-it-qat" }] }), { status: 200 });
      }

      chatCalls += 1;
      const content = JSON.stringify({
        classification: "Out of Scope",
        confidence_score: 0.94,
        reasoning: "The SOW explicitly excludes client portals.",
        relevant_sow_sections: ["Client portals are excluded."],
        request_type: "Engineering",
        estimated_hours: chatCalls === 1 ? 0 : 12,
        estimated_revenue: 0,
        suggested_change_order: "We can scope the portal separately.",
        internal_note: "Explicit exclusion."
      });

      return new Response(JSON.stringify({
        model: "gemma3:12b-it-qat",
        message: { content }
      }), { status: 200 });
    }));

    const result = await analyzeClientRequestDetailed({
      sowText: "Client portals are excluded.",
      messageText: "Can you build a client portal?",
      hourlyRate: 225
    });

    expect(chatCalls).toBe(2);
    expect(result.metadata.status).toBe("Succeeded");
    expect(result.metadata.attempts).toBe(2);
    expect(result.analysis.estimated_hours).toBe(12);
    expect(result.analysis.estimated_revenue).toBe(2700);
  });

  it("fails conservatively when Ollama is unavailable", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_MAX_ATTEMPTS = "1";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection refused"); }));
    const result = await analyzeClientRequestDetailed({
      sowText: "Includes a five page website.",
      messageText: "Can you add a portal?",
      hourlyRate: 175
    });

    expect(result.metadata.status).toBe("Failed");
    expect(result.analysis.classification).toBe("Needs Human Review");
    expect(result.analysis.estimated_revenue).toBe(0);
    expect(result.analysis.reasoning).not.toContain("connection refused");
    const health = await new OllamaProvider().health();

    expect(health.available).toBe(false);
    expect(health.message).toBe(
      "Ollama could not be reached. Check OLLAMA_BASE_URL, the Ollama service, and the local firewall."
    );
  });
});

describe("Anthropic provider", () => {
  const groundedAnalysis = {
    classification: "Out of Scope",
    confidence_score: 0.93,
    reasoning: "The SOW explicitly excludes customer login portals.",
    relevant_sow_sections: ["Excluded: customer login portals."],
    request_type: "Engineering",
    estimated_hours: 20,
    estimated_revenue: 0,
    suggested_change_order: "We can scope the portal as a change order.",
    internal_note: "Explicit exclusion."
  };

  function stubAnthropic(handler: (url: string) => Response) {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => handler(String(input))));
  }

  function modelResponse(id: string) {
    return new Response(JSON.stringify({
      id, type: "model", display_name: id, created_at: "2026-01-01T00:00:00Z"
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  function notFoundResponse() {
    return new Response(JSON.stringify({
      type: "error", error: { type: "not_found_error", message: "model not found" }
    }), { status: 404, headers: { "content-type": "application/json" } });
  }

  function messageResponse(body: Record<string, unknown>) {
    return new Response(JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: JSON.stringify(body) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 100, output_tokens: 50 }
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  it("reports ready when the API key can reach the configured model", async () => {
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    delete process.env.ANTHROPIC_MODEL;
    const requestedUrls: string[] = [];

    stubAnthropic((url) => {
      requestedUrls.push(url);

      return modelResponse("claude-haiku-4-5");
    });
    const health = await new AnthropicProvider().health();

    expect(health.available).toBe(true);
    expect(health.selectedModel).toBe("claude-haiku-4-5");
    expect(requestedUrls).toEqual([expect.stringContaining("/v1/models/claude-haiku-4-5")]);
  });

  it("reports unavailable when the API key cannot reach the configured model", async () => {
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    process.env.ANTHROPIC_MODEL = "claude-not-a-real-model";
    stubAnthropic(() => notFoundResponse());
    const health = await new AnthropicProvider().health();

    expect(health.available).toBe(false);
    expect(health.selectedModel).toBeNull();
    expect(health.message).toContain("claude-not-a-real-model");
  });

  it("reports a rejected key without echoing the key", async () => {
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    delete process.env.ANTHROPIC_MODEL;
    stubAnthropic(() => new Response(JSON.stringify({
      type: "error", error: { type: "authentication_error", message: "invalid x-api-key" }
    }), { status: 401, headers: { "content-type": "application/json" } }));
    const health = await new AnthropicProvider().health();

    expect(health.available).toBe(false);
    expect(health.message).toBe("ANTHROPIC_API_KEY was rejected. Check the key and its workspace permissions.");
    expect(health.message).not.toContain("test-only-key");
  });

  it("reports a missing key without contacting the network", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const fetcher = vi.fn();

    vi.stubGlobal("fetch", fetcher);
    const health = await new AnthropicProvider().health();

    expect(fetcher).not.toHaveBeenCalled();
    expect(health.available).toBe(false);
    expect(health.message).toBe("ANTHROPIC_API_KEY is not configured.");
  });

  it("returns a validated analysis grounded in the supplied SOW", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    process.env.AI_MAX_ATTEMPTS = "1";
    stubAnthropic(() => messageResponse(groundedAnalysis));

    const result = await analyzeClientRequestDetailed({
      sowText: "Excluded: customer login portals.",
      messageText: "Can you add a customer portal?",
      hourlyRate: 175
    });

    expect(result.metadata.status).toBe("Succeeded");
    expect(result.metadata.provider).toBe("anthropic");
    expect(result.metadata.model).toBe("claude-haiku-4-5");
    expect(result.analysis.classification).toBe("Out of Scope");
    expect(result.analysis.estimated_revenue).toBe(3500);
  });

  it("constrains the request to the analysis schema", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    process.env.AI_MAX_ATTEMPTS = "1";
    let sentBody: Record<string, never> | undefined;

    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));

      return messageResponse(groundedAnalysis);
    }));

    await analyzeClientRequestDetailed({
      sowText: "Excluded: customer login portals.",
      messageText: "Can you add a customer portal?",
      hourlyRate: 175
    });

    expect(sentBody).toMatchObject({
      model: "claude-haiku-4-5",
      output_config: { format: { type: "json_schema" } }
    });
  });

  it("redacts a credential that a provider echoes back in an error", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    process.env.AI_MAX_ATTEMPTS = "1";
    stubAnthropic(() => new Response(JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: "bad key sk-ant-api03-AAAABBBBCCCCDDDDEEEE" }
    }), { status: 400, headers: { "content-type": "application/json" } }));

    const result = await analyzeClientRequestDetailed({
      sowText: "Excluded: customer login portals.",
      messageText: "Can you add a customer portal?",
      hourlyRate: 175
    });

    expect(result.metadata.status).toBe("Failed");
    expect(result.metadata.errorMessage).not.toContain("sk-ant-api03-AAAABBBBCCCCDDDDEEEE");
    expect(result.metadata.errorMessage).toContain("[REDACTED]");
  });

  it("falls back to human review when the model declines", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-only-key";
    process.env.AI_MAX_ATTEMPTS = "1";
    stubAnthropic(() => new Response(JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: JSON.stringify(groundedAnalysis) }],
      stop_reason: "refusal",
      usage: { input_tokens: 100, output_tokens: 50 }
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await analyzeClientRequestDetailed({
      sowText: "Excluded: customer login portals.",
      messageText: "Can you add a customer portal?",
      hourlyRate: 175
    });

    expect(result.metadata.status).toBe("Failed");
    expect(result.analysis.classification).toBe("Needs Human Review");
    expect(result.analysis.estimated_revenue).toBe(0);
  });
});

describe("provider catalog", () => {
  it("describes every provider the application can select", () => {
    expect([...CATALOG_PROVIDER_NAMES].sort()).toEqual(
      AI_PROVIDERS.filter((name) => name !== "demo").slice().sort()
    );
  });

  it("prefers the environment model over the catalog default", () => {
    delete process.env.ANTHROPIC_MODEL;
    expect(configuredModelFor("anthropic")).toBe("claude-haiku-4-5");
    process.env.ANTHROPIC_MODEL = "claude-opus-5";
    expect(configuredModelFor("anthropic")).toBe("claude-opus-5");
  });

  it("leaves the Ollama model unset so installed models can be discovered", () => {
    delete process.env.OLLAMA_MODEL;
    expect(configuredModelFor("ollama")).toBeNull();
    expect(displayModelFor("ollama")).toBe("Automatic model selection");
  });

  it("reports only the credentials a provider actually needs", () => {
    expect(missingEnvironmentFor("anthropic", {})).toEqual(["ANTHROPIC_API_KEY"]);
    expect(missingEnvironmentFor("anthropic", { ANTHROPIC_API_KEY: "set" })).toEqual([]);
    expect(missingEnvironmentFor("ollama", {})).toEqual([]);
  });
});

describe("provider configuration", () => {
  it("uses deterministic demo analysis by default in tests", () => {
    delete process.env.AI_PROVIDER;
    expect(configuredProviderName()).toBe("demo");
  });

  it("selects the Anthropic API outside tests when AI_PROVIDER is unset", () => {
    delete process.env.AI_PROVIDER;
    vi.stubEnv("NODE_ENV", "production");
    expect(configuredProviderName()).toBe("anthropic");
    vi.unstubAllEnvs();
  });
});

describe("provider cancellation", () => {
  it("does not start or retry a provider request after cancellation", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-only-key";
    process.env.AI_MAX_ATTEMPTS = "3";
    const fetcher = vi.fn();

    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    controller.abort();

    const result = await analyzeClientRequestDetailed({
      sowText: "The project includes five website pages.",
      boundaryMapText: "Included: five website pages.",
      messageText: "Can we add a sixth page?",
      hourlyRate: 175,
      signal: controller.signal,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.metadata.status).toBe("Failed");
    expect(result.metadata.attempts).toBe(0);
  });
});
