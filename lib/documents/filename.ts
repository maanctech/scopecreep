import path from "node:path";

export function safeDocumentFilename(filename: string) {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._ -]/g, "_").trim();

  if (!base || base === "." || base === "..") throw new Error("The document filename is invalid.");

  return base.slice(0, 180);
}
