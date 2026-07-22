import { createHash } from "node:crypto";
import { z } from "zod";
import { AI_PROMPT_VERSION, AI_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/aiPrompt";
import { configuredFallbackProviderName, configuredProviderName, providerFor } from "@/lib/ai/providers";
import type { AiProviderName, DetailedAnalysis } from "@/lib/ai/types";
import { CLASSIFICATIONS, REQUEST_TYPES, type AnalysisInput } from "@/lib/types";

const analysisSchema = z.object({
  classification: z.enum(CLASSIFICATIONS),
  confidence_score: z.coerce.number().finite().nonnegative(),
  reasoning: z.string().trim().min(1),
  relevant_sow_sections: z
    .preprocess((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.trim()) return [value];
      return [];
    }, z.array(z.string().trim().min(1)).default([]))
    .default([]),
  request_type: z.enum(REQUEST_TYPES).catch("Other"),
  estimated_hours: z.coerce.number().finite().min(0).max(1000),
  estimated_revenue: z.coerce.number().finite().min(0),
  suggested_change_order: z
    .string()
    .trim()
    .min(1)
    .catch("Review this request with the project manager before responding to the client."),
  internal_note: z
    .string()
    .trim()
    .min(1)
    .catch("Review this result before using it for client communication.")
}).strict();

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeConfidence(value: number) {
  if (value > 1 && value <= 100) {
    return roundCurrency(value / 100);
  }

  return value;
}

function extractJson(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function normalizeParsedAnalysis(
  parsed: z.infer<typeof analysisSchema>,
  hourlyRate: number
): AnalysisInput {
  const confidenceScore = normalizeConfidence(parsed.confidence_score);
  if (confidenceScore < 0 || confidenceScore > 1) {
    throw new Error("AI confidence_score must be between 0 and 1.");
  }

  const estimatedHours = parsed.classification === "In Scope" ? 0 : parsed.estimated_hours;
  const estimatedRevenue = roundCurrency(estimatedHours * hourlyRate);

  return {
    ...parsed,
    confidence_score: confidenceScore,
    estimated_hours: estimatedHours,
    estimated_revenue: estimatedRevenue,
    internal_note: parsed.internal_note
  };
}

function assertEvidence(result: AnalysisInput) {
  if (
    (result.classification === "Out of Scope" || result.classification === "In Scope") &&
    result.relevant_sow_sections.length === 0
  ) {
    throw new Error(`${result.classification} requires SOW evidence.`);
  }
  return result;
}

const EVIDENCE_STOP_WORDS = new Set([
  "that", "this", "with", "from", "will", "would", "scope", "project", "includes", "included"
]);

function evidenceTokens(value: string) {
  return new Set(
    value.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length >= 4 && !EVIDENCE_STOP_WORDS.has(word)) ?? []
  );
}

export function validateSowEvidence(result: AnalysisInput, sowText: string) {
  if (result.classification !== "Out of Scope" && result.classification !== "In Scope") return result;
  const sowTokens = evidenceTokens(sowText);
  for (const evidence of result.relevant_sow_sections) {
    const tokens = Array.from(evidenceTokens(evidence));
    const overlap = tokens.filter((token) => sowTokens.has(token)).length;
    const requiredOverlap = Math.max(1, Math.ceil(Math.min(tokens.length, 6) / 2));
    if (!tokens.length || overlap < requiredOverlap) {
      throw new Error("AI SOW evidence is not grounded in the supplied SOW.");
    }
  }
  return result;
}

export function parseAnalysisJson(raw: string, hourlyRate: number): AnalysisInput {
  return assertEvidence(normalizeParsedAnalysis(analysisSchema.parse(JSON.parse(extractJson(raw))), hourlyRate));
}

export function validateAnalysisResult(value: unknown, hourlyRate: number): AnalysisInput {
  return assertEvidence(normalizeParsedAnalysis(analysisSchema.parse(value), hourlyRate));
}

export function fallbackAnalysis(_reason: string): AnalysisInput {
  return {
    classification: "Needs Human Review",
    confidence_score: 0.35,
    reasoning:
      "The automated analysis could not produce a valid, reliable scope decision. A human should review this request against the SOW.",
    relevant_sow_sections: [],
    request_type: "Other",
    estimated_hours: 0,
    estimated_revenue: 0,
    suggested_change_order:
      "Thanks for the request. We are reviewing it against the current Statement of Work and will confirm whether it fits the existing scope or requires a change order before proceeding.",
    internal_note: "AI analysis was unavailable or invalid. A human should review before discussing billing."
  };
}

function findExplicitExclusion(sow: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`does\\s+not\\s+include[^.]*\\b${escaped}\\b`, "i"),
    new RegExp(`excludes?[^.]*\\b${escaped}\\b`, "i"),
    new RegExp(`not\\s+included[^.]*\\b${escaped}\\b`, "i"),
    new RegExp(`outside\\s+(?:the\\s+)?scope[^.]*\\b${escaped}\\b`, "i")
  ];

  return patterns.find((pattern) => pattern.test(sow))?.exec(sow)?.[0] ?? null;
}

function localHeuristicAnalysis(input: {
  sowText: string;
  messageText: string;
  hourlyRate: number;
}): AnalysisInput {
  const message = input.messageText.toLowerCase();
  const sow = input.sowText;
  const excludedRules = [
    {
      label: "dark mode",
      messageTerms: ["dark mode"],
      evidenceTerms: ["dark mode"],
      requestType: "Engineering",
      hours: 6
    },
    {
      label: "SEO or new content",
      messageTerms: ["seo", "blog", "copy"],
      evidenceTerms: ["seo", "copywriting"],
      requestType: "New Deliverable",
      hours: 9
    },
    {
      label: "login portal, account area, or custom dashboard",
      messageTerms: ["login", "portal", "account", "invoice", "dashboard"],
      evidenceTerms: ["user accounts", "custom dashboards"],
      requestType: "Engineering",
      hours: 40
    },
    {
      label: "e-commerce",
      messageTerms: ["e-commerce", "ecommerce", "checkout", "cart"],
      evidenceTerms: ["e-commerce"],
      requestType: "Engineering",
      hours: 30
    },
    {
      label: "maintenance",
      messageTerms: ["maintenance", "support after launch", "after launch"],
      evidenceTerms: ["ongoing maintenance"],
      requestType: "Support",
      hours: 4
    },
    {
      label: "paid ads",
      messageTerms: ["paid ads", "ad campaign", "google ads", "meta ads"],
      evidenceTerms: ["paid ads"],
      requestType: "Strategy",
      hours: 8
    }
  ] as const;

  const matched = excludedRules
    .map((rule) => ({
      ...rule,
      evidence: rule.messageTerms.some((term) => message.includes(term))
        ? rule.evidenceTerms.map((term) => findExplicitExclusion(sow, term)).find(Boolean)
        : null
    }))
    .find((item) => item.evidence);

  if (matched) {
    const { label, requestType, hours, evidence } = matched;
    return {
      classification: "Out of Scope",
      confidence_score: 0.88,
      reasoning: `The client request appears to involve ${label}, which the SOW explicitly excludes.`,
      relevant_sow_sections: [evidence ?? `SOW excludes: ${label}`],
      request_type: requestType,
      estimated_hours: hours,
      estimated_revenue: roundCurrency(hours * input.hourlyRate),
      suggested_change_order: `We can support this request as an additional scope item. Based on the current SOW, it appears to fall outside the included work. We estimate ${hours} additional hours, or $${roundCurrency(hours * input.hourlyRate).toLocaleString()}. Please confirm if you would like us to prepare a change order.`,
      internal_note: "Local demo analysis used because live OpenAI settings are not configured."
    };
  }

  if (message.includes("headline") || message.includes("spacing") || message.includes("tweak")) {
    return {
      classification: "Possibly In Scope",
      confidence_score: 0.68,
      reasoning:
        "The request looks like a design or content tweak that may fit inside the included revision round, but the app cannot verify whether the revision round has been exhausted.",
      relevant_sow_sections: ["The project includes one round of design revisions."],
      request_type: message.includes("headline") ? "Revision" : "Design",
      estimated_hours: 0,
      estimated_revenue: 0,
      suggested_change_order:
        "This may fit within the included revision round. We will verify it against the current revision list and confirm before treating it as additional scope.",
      internal_note: "Check revision history before approving as in-scope."
    };
  }

  return {
    classification: "Needs Human Review",
    confidence_score: 0.5,
    reasoning:
      "The request is not clearly covered or excluded based on the available SOW text. A human should clarify the deliverable and timing.",
    relevant_sow_sections: [],
    request_type: "Other",
    estimated_hours: 2,
    estimated_revenue: roundCurrency(2 * input.hourlyRate),
    suggested_change_order:
      "Could you clarify the exact deliverable, timing, and acceptance criteria for this request? Once we have those details, we can confirm whether it fits the current SOW or needs a change order.",
    internal_note: "Local demo analysis used. Ask clarifying questions before billing."
  };
}

export async function analyzeClientRequest(input: {
  sowText: string;
  messageText: string;
  hourlyRate: number;
}): Promise<AnalysisInput> {
  return (await analyzeClientRequestDetailed(input)).analysis;
}

export async function analyzeClientRequestDetailed(input: {
  sowText: string;
  messageText: string;
  hourlyRate: number;
}): Promise<DetailedAnalysis> {
  const userPrompt = buildAnalysisPrompt(input);
  const inputHash = createHash("sha256")
    .update(`${AI_PROMPT_VERSION}\n${AI_SYSTEM_PROMPT}\n${userPrompt}`)
    .digest("hex");
  const primary = configuredProviderName();
  if (primary === "demo") {
    return {
      analysis: localHeuristicAnalysis(input),
      metadata: {
        provider: "demo",
        model: "deterministic",
        promptVersion: AI_PROMPT_VERSION,
        inputHash,
        attempts: 1,
        status: "Succeeded",
        errorMessage: null
      }
    };
  }

  const fallback = configuredFallbackProviderName();
  const providerNames = [primary, fallback]
    .filter((name): name is Exclude<AiProviderName, "demo"> => Boolean(name && name !== "demo"))
    .filter((name, index, names) => names.indexOf(name) === index);
  const attemptsSetting = Number(process.env.AI_MAX_ATTEMPTS || 2);
  const timeoutSetting = Number(process.env.AI_TIMEOUT_MS || 90_000);
  const maxAttempts = Number.isFinite(attemptsSetting) ? Math.min(3, Math.max(1, Math.trunc(attemptsSetting))) : 2;
  const timeoutMs = Number.isFinite(timeoutSetting) ? Math.min(300_000, Math.max(1_000, timeoutSetting)) : 90_000;
  let attempts = 0;
  let lastProvider: AiProviderName = primary;
  let lastModel = "unavailable";
  let lastError = "AI provider unavailable.";

  for (const providerName of providerNames) {
    const provider = providerFor(providerName);
    lastProvider = providerName;
    for (let providerAttempt = 1; providerAttempt <= maxAttempts; providerAttempt += 1) {
      attempts += 1;
      try {
        const correction = providerAttempt > 1
          ? "\n\nYour previous response was invalid. Return one complete JSON object matching the required shape, with SOW evidence for any definitive In Scope or Out of Scope decision."
          : "";
        const response = await provider.generate({
          systemPrompt: AI_SYSTEM_PROMPT,
          userPrompt: `${userPrompt}${correction}`,
          timeoutMs
        });
        lastModel = response.model;
        return {
          analysis: validateSowEvidence(parseAnalysisJson(response.content, input.hourlyRate), input.sowText),
          metadata: {
            provider: providerName,
            model: response.model,
            promptVersion: AI_PROMPT_VERSION,
            inputHash,
            attempts,
            status: "Succeeded",
            errorMessage: null
          }
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message.slice(0, 500) : "Unknown AI provider error.";
      }
    }
  }

  return {
    analysis: fallbackAnalysis(lastError),
    metadata: {
      provider: lastProvider,
      model: lastModel,
      promptVersion: AI_PROMPT_VERSION,
      inputHash,
      attempts,
      status: "Failed",
      errorMessage: lastError
    }
  };
}
