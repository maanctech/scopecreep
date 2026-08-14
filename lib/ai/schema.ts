export const analysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "classification",
    "confidence_score",
    "reasoning",
    "relevant_sow_sections",
    "request_type",
    "estimated_hours",
    "estimated_revenue",
    "suggested_change_order",
    "internal_note"
  ],
  properties: {
    classification: {
      type: "string",
      enum: ["In Scope", "Possibly In Scope", "Out of Scope", "Needs Human Review"]
    },
    confidence_score: { type: "number" },
    reasoning: { type: "string" },
    relevant_sow_sections: { type: "array", items: { type: "string" } },
    request_type: {
      type: "string",
      enum: ["New Deliverable", "Revision", "Support", "Strategy", "Design", "Engineering", "Admin", "Other"]
    },
    estimated_hours: { type: "number" },
    estimated_revenue: { type: "number" },
    suggested_change_order: { type: "string" },
    internal_note: { type: "string" }
  }
} as const;
