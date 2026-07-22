import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeClientRequestDetailed } from "@/lib/analysis";
import { OllamaProvider, listOllamaModels } from "@/lib/ai/ollama";
import { configuredProviderName } from "@/lib/ai/providers";

const originalProvider = process.env.AI_PROVIDER;
const originalModel = process.env.OLLAMA_MODEL;
const originalAttempts = process.env.AI_MAX_ATTEMPTS;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

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
  });
});

describe("provider configuration", () => {
  it("uses deterministic demo analysis by default in tests", () => {
    delete process.env.AI_PROVIDER;
    expect(configuredProviderName()).toBe("demo");
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
