import { describe, expect, it } from "vitest";
import { parseManualImport } from "@/lib/ingestion/manual";

describe("manual communication import", () => {
  it("normalizes CSV aliases and reports invalid timestamps", () => {
    const result = parseManualImport({
      format: "CSV",
      content:
        "external_id,sender,message_text,timestamp\nmsg-1,Client,Please add a portal,not-a-date",
    });

    expect(result.messages[0]).toMatchObject({
      externalId: "msg-1",
      sender: "Client",
      text: "Please add a portal",
      timestamp: null,
    });
    expect(result.warnings).toHaveLength(1);
  });

  it("accepts JSON export wrappers and split pasted text", () => {
    const json = parseManualImport({
      format: "JSON",
      content: JSON.stringify({
        messages: [
          { id: 1, text: "First request" },
          { id: 2, message: "Second request" },
        ],
      }),
    });

    expect(json.messages.map((message) => message.externalId)).toEqual([
      "1",
      "2",
    ]);
    const text = parseManualImport({
      format: "Text",
      content: "First message\n---\nSecond message",
    });

    expect(text.messages).toHaveLength(2);
  });

  it("rejects empty and oversized imports", () => {
    expect(() => parseManualImport({ format: "JSON", content: "[]" })).toThrow(
      /No valid messages/,
    );
    expect(() =>
      parseManualImport({
        format: "Text",
        content: "x".repeat(5 * 1024 * 1024 + 1),
      }),
    ).toThrow(/5 MB/);
  });

  it("normalizes WebVTT and SRT transcript cues into speaker messages", () => {
    const result = parseManualImport({
      format: "Transcript",
      content:
        "WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nMorgan Lee: Could we add customer SSO?\n\n2\n00:00:05,000 --> 00:00:08,000\nAlex: I will check the agreement.",
    });

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({
      sender: "Morgan Lee",
      text: "Could we add customer SSO?",
    });
  });
});
