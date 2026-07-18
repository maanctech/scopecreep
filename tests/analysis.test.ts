import { describe, expect, it } from "vitest";
import { analyzeClientRequest, fallbackAnalysis, parseAnalysisJson, validateAnalysisResult } from "@/lib/analysis";

describe("parseAnalysisJson", () => {
  it("parses valid structured JSON and recalculates revenue", () => {
    const result = parseAnalysisJson(
      JSON.stringify({
        classification: "Out of Scope",
        confidence_score: 0.91,
        reasoning: "The SOW excludes dark mode.",
        relevant_sow_sections: ["The project does not include dark mode."],
        request_type: "Engineering",
        estimated_hours: 6,
        estimated_revenue: 1,
        suggested_change_order: "We can add this as a change order.",
        internal_note: "Explicit exclusion."
      }),
      150
    );

    expect(result.classification).toBe("Out of Scope");
    expect(result.estimated_revenue).toBe(900);
  });

  it("accepts fenced JSON returned by an LLM", () => {
    const result = parseAnalysisJson(
      `\`\`\`json
{
  "classification": "Needs Human Review",
  "confidence_score": 0.5,
  "reasoning": "The request is ambiguous.",
  "relevant_sow_sections": [],
  "request_type": "Other",
  "estimated_hours": 2,
  "estimated_revenue": 300,
  "suggested_change_order": "Please clarify the request.",
  "internal_note": "Needs PM review."
}
\`\`\``,
      200
    );

    expect(result.classification).toBe("Needs Human Review");
    expect(result.estimated_revenue).toBe(400);
  });

  it("extracts JSON when a model wraps it in extra text", () => {
    const result = parseAnalysisJson(
      `Here is the result:
{
  "classification": "Out of Scope",
  "confidence_score": 85,
  "reasoning": "The SOW excludes user accounts.",
  "relevant_sow_sections": "Does not include user accounts.",
  "request_type": "Engineering",
  "estimated_hours": 10,
  "estimated_revenue": 0,
  "suggested_change_order": "Review before sending.",
  "internal_note": "Explicit exclusion."
}
Thanks.`,
      200
    );

    expect(result.confidence_score).toBe(0.85);
    expect(result.relevant_sow_sections).toEqual(["Does not include user accounts."]);
    expect(result.estimated_revenue).toBe(2000);
  });

  it("defaults non-critical missing AI fields instead of failing valid decisions", () => {
    const result = parseAnalysisJson(
      JSON.stringify({
        classification: "Needs Human Review",
        confidence_score: 0.4,
        reasoning: "The SOW is ambiguous.",
        relevant_sow_sections: [],
        estimated_hours: 1,
        estimated_revenue: 999
      }),
      150
    );

    expect(result.request_type).toBe("Other");
    expect(result.suggested_change_order).toMatch(/Review this request/);
    expect(result.internal_note).toMatch(/Review this result/);
    expect(result.estimated_revenue).toBe(150);
  });

  it("forces in-scope work to zero estimated revenue", () => {
    const result = parseAnalysisJson(
      JSON.stringify({
        classification: "In Scope",
        confidence_score: 0.8,
        reasoning: "Covered by the revision round.",
        relevant_sow_sections: ["Includes one round of design revisions."],
        request_type: "Revision",
        estimated_hours: 3,
        estimated_revenue: 450,
        suggested_change_order: "This appears included.",
        internal_note: "Verify revision round status."
      }),
      150
    );

    expect(result.estimated_hours).toBe(0);
    expect(result.estimated_revenue).toBe(0);
  });

  it("rejects invalid classifications", () => {
    expect(() =>
      parseAnalysisJson(
        JSON.stringify({
          classification: "Maybe",
          confidence_score: 0.8,
          reasoning: "Invalid.",
          relevant_sow_sections: [],
          request_type: "Other",
          estimated_hours: 0,
          estimated_revenue: 0,
          suggested_change_order: "Invalid.",
          internal_note: "Invalid."
        }),
        150
      )
    ).toThrow();
  });
});

describe("fallbackAnalysis", () => {
  it("returns a conservative human-review result", () => {
    const result = fallbackAnalysis("Raw provider error that should not be exposed.");

    expect(result.classification).toBe("Needs Human Review");
    expect(result.estimated_revenue).toBe(0);
    expect(result.reasoning).not.toContain("Raw provider error");
  });
});

describe("validateAnalysisResult", () => {
  it("revalidates analysis objects before persistence", () => {
    expect(() =>
      validateAnalysisResult(
        {
          classification: "Out of Scope",
          confidence_score: 120,
          reasoning: "Invalid confidence.",
          relevant_sow_sections: [],
          request_type: "Other",
          estimated_hours: 1,
          estimated_revenue: 0,
          suggested_change_order: "Review.",
          internal_note: "Invalid."
        },
        150
      )
    ).toThrow(/confidence_score/);
  });
});

describe("analyzeClientRequest local fallback", () => {
  it("does not call included work out of scope just because a keyword appears in the SOW", async () => {
    const oldKey = process.env.OPENAI_API_KEY;
    const oldModel = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;

    const result = await analyzeClientRequest({
      sowText: "The project includes e-commerce checkout and product catalog setup.",
      messageText: "Can you add e-commerce checkout before launch?",
      hourlyRate: 150
    });

    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = oldModel;

    expect(result.classification).toBe("Needs Human Review");
  });

  it("flags login portal requests when the SOW excludes user accounts", async () => {
    const oldKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await analyzeClientRequest({
      sowText: "The project does not include user accounts or custom dashboards.",
      messageText: "Could you build a client login portal where customers can see invoices?",
      hourlyRate: 150
    });

    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;

    expect(result.classification).toBe("Out of Scope");
    expect(result.relevant_sow_sections[0]).toContain("user accounts");
  });

  it("flags dashboard requests when the SOW excludes custom dashboards", async () => {
    const oldKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await analyzeClientRequest({
      sowText: "The engagement does not include custom dashboards or software implementation.",
      messageText: "Can you build a dashboard for the leadership team?",
      hourlyRate: 175
    });

    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;

    expect(result.classification).toBe("Out of Scope");
    expect(result.relevant_sow_sections[0]).toContain("custom dashboards");
  });
});
