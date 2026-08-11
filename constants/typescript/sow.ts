// Generated from constants/json by `npm run constants:generate`. Do not edit.

export const BOUNDARY_TYPES = [
  "Included",
  "Excluded",
  "Ambiguous",
  "Assumption",
  "Limit"
] as const;

export const DOCUMENT_STATUSES = [
  "Draft",
  "Active",
  "Superseded",
  "Archived"
] as const;

export const VERSION_SOURCE_TYPES = [
  "Pasted Text",
  "TXT",
  "DOCX",
  "PDF",
  "Imported JSON",
  "Generated"
] as const;

export const EXTRACTION_STATUSES = [
  "Succeeded",
  "Needs Manual Text",
  "Failed"
] as const;

export const BOUNDARY_MAP_STATUSES = [
  "Draft",
  "Active",
  "Archived"
] as const;

export const RISK_REVIEW_STATUSES = [
  "Draft",
  "Reviewed"
] as const;

export const RISK_SEVERITIES = [
  "High",
  "Medium",
  "Low"
] as const;

export const MAX_SOW_FILE_BYTES = 10485760;

export const MAX_EXTRACTED_CHARACTERS = 2097152;
