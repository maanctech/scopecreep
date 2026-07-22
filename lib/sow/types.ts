export const BOUNDARY_TYPES = ["Included", "Excluded", "Ambiguous", "Assumption", "Limit"] as const;
export type BoundaryType = (typeof BOUNDARY_TYPES)[number];

export type SowVersion = {
  id: string;
  versionNumber: number;
  sourceType: string;
  sourceFilename: string | null;
  content: string;
  contentHash: string;
  changeNote: string | null;
  extractionStatus: "Succeeded" | "Needs Manual Text" | "Failed";
  extractionWarning: string | null;
  createdAt: string;
  isActive: boolean;
};

export type SowSection = { id: string; heading: string | null; body: string; ordinal: number };

export type BoundaryItem = {
  id: string;
  boundaryType: BoundaryType;
  category: string;
  description: string;
  evidence: string;
  ordinal: number;
};

export type RiskItem = {
  id: string;
  severity: "High" | "Medium" | "Low";
  category: string;
  description: string;
  recommendation: string;
  evidence: string;
};

export type SowWorkspace = {
  document: { id: string; title: string } | null;
  versions: SowVersion[];
  activeVersion: SowVersion | null;
  sections: SowSection[];
  boundaryMap: { id: string; name: string; status: "Draft" | "Active" | "Archived"; approvedAt: string | null; items: BoundaryItem[] } | null;
  riskReview: { id: string; status: "Draft" | "Reviewed"; summary: string; provider: string; model: string; items: RiskItem[] } | null;
};
