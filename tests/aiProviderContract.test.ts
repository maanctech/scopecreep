import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOG_PROVIDER_NAMES, PROVIDER_CATALOG } from "@/lib/ai/catalog";
import { providerFor } from "@/lib/ai/providers";
import { analysisJsonSchema } from "@/lib/ai/schema";
import type { AiRequest, RemoteAiProviderName } from "@/lib/ai/types";

const CREDENTIALS: Record<RemoteAiProviderName, Record<string, string>> = {
  anthropic: { ANTHROPIC_API_KEY: "test-only-key" },
  openai: { OPENAI_API_KEY: "test-only-key" }
};

const GROUNDED_ANALYSIS = {
  classification: "Out of Scope",
  confidence_score: 0.9,
  reasoning: "The SOW excludes customer login portals.",
  relevant_sow_sections: ["Excluded: customer login portals."],
  request_type: "Engineering",
  estimated_hours: 12,
  estimated_revenue: 0,
  suggested_change_order: "We can scope this as a change order.",
  internal_note: "Explicit exclusion."
};

function request(overrides: Partial<AiRequest> = {}): AiRequest {
  return {
    systemPrompt: "You analyze scope.",
    userPrompt: "Can you add a customer portal?",
    jsonSchema: analysisJsonSchema,
    maxOutputTokens: 1200,
    timeoutMs: 5_000,
    ...overrides
  };
}

function applyCredentials(name: RemoteAiProviderName) {
  for (const [variable, value] of Object.entries(CREDENTIALS[name])) {
    vi.stubEnv(variable, value);
  }

  vi.stubEnv(PROVIDER_CATALOG[name].modelEnvironmentVariable, "test-model");
}

function successResponse(name: RemoteAiProviderName, url: string) {
  const serialized = JSON.stringify(GROUNDED_ANALYSIS);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  if (name === "anthropic") {
    if (url.includes("/v1/models/")) return json({ id: "test-model", type: "model", display_name: "test-model", created_at: "2026-01-01T00:00:00Z" });

    return json({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "test-model",
      content: [{ type: "text", text: serialized }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 10 }
    });
  }

  return json({ model: "test-model", choices: [{ message: { content: serialized } }] });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(CATALOG_PROVIDER_NAMES)("%s adapter honors the shared provider contract", (name) => {
  it("returns the raw content and the model that produced it", async () => {
    applyCredentials(name);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => successResponse(name, String(input))));

    const response = await providerFor(name).generate(request());

    expect(response.model).toBe("test-model");
    expect(JSON.parse(response.content)).toMatchObject({ classification: "Out of Scope" });
  });

  it("sends the caller's schema rather than a provider default", async () => {
    applyCredentials(name);
    const bodies: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.body) bodies.push(String(init.body));

      return successResponse(name, String(input));
    }));

    await providerFor(name).generate(request({ jsonSchema: { type: "object", properties: { marker: { type: "string" } } } }));

    expect(bodies.join("")).toContain("marker");
  });

  it("reports an unavailable provider instead of throwing", async () => {
    applyCredentials(name);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection refused"); }));

    const health = await providerFor(name).health();

    expect(health.provider).toBe(name);
    expect(health.available).toBe(false);
    expect(health.message).not.toContain("connection refused");
    expect(health.message).not.toContain("test-only-key");
  });

  it("rejects instead of returning a result when the caller cancels", async () => {
    applyCredentials(name);

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");

      return successResponse(name, String(input));
    }));

    const controller = new AbortController();

    controller.abort();

    await expect(providerFor(name).generate(request({ signal: controller.signal }))).rejects.toThrow();
  });
});
