import { describe, expect, it } from "vitest";
import {
  verifyWebhookSignature,
  webhookSignature,
} from "@/lib/ingestion/webhook";

describe("signed inbound webhooks", () => {
  it("accepts a valid timestamped HMAC and rejects tampering", () => {
    const now = Date.parse("2026-07-22T12:00:00Z");
    const timestamp = String(Math.floor(now / 1000));
    const body = JSON.stringify({
      messages: [{ id: "1", text: "Client request" }],
    });
    const signature = webhookSignature("secret", timestamp, body);
    expect(() =>
      verifyWebhookSignature({
        secret: "secret",
        timestamp,
        signature,
        body,
        now,
      }),
    ).not.toThrow();
    expect(() =>
      verifyWebhookSignature({
        secret: "secret",
        timestamp,
        signature,
        body: `${body}x`,
        now,
      }),
    ).toThrow(/invalid/);
  });

  it("rejects expired deliveries before parsing", () => {
    const now = Date.parse("2026-07-22T12:10:01Z");
    const timestamp = String(
      Math.floor(Date.parse("2026-07-22T12:00:00Z") / 1000),
    );
    expect(() =>
      verifyWebhookSignature({
        secret: "secret",
        timestamp,
        signature: webhookSignature("secret", timestamp, "{}"),
        body: "{}",
        now,
      }),
    ).toThrow(/expired/);
  });
});
