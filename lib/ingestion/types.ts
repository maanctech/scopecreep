export type NormalizedCommunication = {
  externalId: string | null;
  externalThreadId: string | null;
  sender: string | null;
  senderEmail: string | null;
  recipients: string[];
  timestamp: string | null;
  editedTimestamp: string | null;
  subject: string | null;
  text: string;
  rawMetadata: Record<string, unknown>;
};

export type ImportPreview = {
  format: "Text" | "CSV" | "JSON" | "Transcript";
  messages: NormalizedCommunication[];
  warnings: string[];
};
