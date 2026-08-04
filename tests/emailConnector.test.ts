import { describe, expect, it } from "vitest";
import { emailConfigSchema } from "@/lib/ingestion/email";

describe("IMAP connector contract", () => {
  it("requires explicit project routing, credentials, and a valid TLS port", () => {
    const parsed = emailConfigSchema.parse({
      projectId: "10000000-0000-4000-8000-000000000001",
      name: "Audit inbox",
      host: "imap.example.com",
      port: 993,
      secure: true,
      username: "audit@example.com",
      password: "secret",
      folder: "Clients",
      allowedSenderDomains: ["client.example"],
    });

    expect(parsed).toMatchObject({
      secure: true,
      folder: "Clients",
      allowedSenderDomains: ["client.example"],
    });
    expect(() => emailConfigSchema.parse({ ...parsed, port: 0 })).toThrow();
    expect(() =>
      emailConfigSchema.parse({
        ...parsed,
        allowedSenderDomains: ["https://bad.example/path"],
      }),
    ).toThrow();
  });
});
