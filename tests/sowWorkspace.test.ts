import { describe, expect, it } from "vitest";
import { extractSowFile, safeDocumentFilename, splitSowSections } from "@/lib/sow/extraction";
import { sanitizeSowReview, validateSowReview } from "@/lib/sow/analysis";

describe("SOW document extraction", () => {
  it("extracts UTF-8 text and removes path components from filenames", async () => {
    const result = await extractSowFile({
      buffer: Buffer.from("SERVICES\nThe agency will design five website pages and provide one revision round."),
      filename: "../../client-agreement.txt",
      mediaType: "text/plain"
    });

    expect(result.safeFilename).toBe("client-agreement.txt");
    expect(result.sourceType).toBe("TXT");
    expect(result.text).toContain("five website pages");
  });

  it("rejects unsupported and content-free files with actionable errors", async () => {
    await expect(extractSowFile({ buffer: Buffer.from("content"), filename: "agreement.exe" })).rejects.toThrow(/TXT, DOCX/);
    await expect(
      extractSowFile({ buffer: Buffer.from("%PDF-1.4 truncated and unreadable"), filename: "scan.pdf" })
    ).rejects.toThrow(/PDF.*paste/);
    expect(() => safeDocumentFilename("../.." )).toThrow(/filename/);
  });

  it("rejects a file whose bytes do not match its extension", async () => {
    // The extension chooses the parser, so a mismatch would hand arbitrary
    // content to the zip or PDF reader.
    await expect(
      extractSowFile({ buffer: Buffer.from("this is plain text"), filename: "payload.docx" })
    ).rejects.toThrow(/do not match its extension/);
    await expect(
      extractSowFile({ buffer: Buffer.from("PK zip pretending to be a pdf"), filename: "payload.pdf" })
    ).rejects.toThrow(/do not match its extension/);
  });

  it("creates stable ordered sections", () => {
    const sections = splitSowSections("SERVICES\nFive page website design.\nEXCLUSIONS\nE-commerce is not included.");

    expect(sections.map((section) => section.heading)).toEqual(["SERVICES", "EXCLUSIONS"]);
    expect(sections[1].body).toContain("E-commerce");
  });
});

describe("SOW risk and boundary validation", () => {
  it("accepts grounded evidence and rejects invented contract terms", () => {
    const sow = "The agency will design five website pages. E-commerce functionality is excluded.";
    const base = {
      summary: "The agreement includes a website and excludes commerce.",
      boundary_items: [{ boundary_type: "Excluded", category: "Functionality", description: "No store", evidence: "E-commerce functionality is excluded." }],
      risk_items: []
    };

    expect(validateSowReview(base, sow).boundary_items).toHaveLength(1);
    expect(validateSowReview({ ...base, risk_items: [{ severity: "High", category: "Payment terms", description: "No payment deadline is stated.", recommendation: "Add one.", evidence: "No supporting clause found in the supplied SOW." }] }, sow).risk_items).toHaveLength(1);
    expect(() => validateSowReview({ ...base, boundary_items: [{ ...base.boundary_items[0], evidence: "Cryptocurrency settlement and blockchain custody are excluded." }] }, sow)).toThrow(/not grounded/);
    const sanitized = sanitizeSowReview({ ...base, boundary_items: [...base.boundary_items, { ...base.boundary_items[0], evidence: "Cryptocurrency settlement and blockchain custody are excluded." }] }, sow);

    expect(sanitized.boundary_items).toHaveLength(1);
    expect(sanitized.summary).toContain("omitted automatically");
  });
});
