import { describe, expect, it, vi } from "vitest";
import { assertProviderUrl } from "@/lib/connectors/http";
import {
  createGoogleConnector,
  normalizeGmailMessage,
} from "@/lib/connectors/google";
import {
  createMicrosoftConnector,
  normalizeGraphMail,
} from "@/lib/connectors/microsoft";
import { oauthProviderDefinition } from "@/lib/connectors/oauth";
import {
  createSlackConnector,
  normalizeSlackMessage,
} from "@/lib/connectors/slack";

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("platform connector contracts", () => {
  it("normalizes Slack edits, threads, and deletion tombstones", () => {
    expect(
      normalizeSlackMessage(
        {
          ts: "1720000000.000001",
          thread_ts: "1719999999.000001",
          text: "Please add SSO",
          edited: { ts: "1720000010.000001" },
        },
        "C123",
        { name: "Client", email: "client@example.com" },
      ),
    ).toMatchObject({
      externalThreadId: "1719999999.000001",
      editedTimestamp: expect.any(String),
      text: "Please add SSO",
    });
    expect(
      normalizeSlackMessage(
        { deleted_ts: "1720000000.000001", subtype: "message_deleted" },
        "C123",
        { name: null, email: null },
      ),
    ).toMatchObject({
      externalId: "1720000000.000001",
      text: "Message deleted at source.",
    });
  });

  it("performs an incremental Slack channel sync with a checkpoint", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("conversations.history"))
        return response({
          ok: true,
          messages: [
            { ts: "1720000000.000001", user: "U1", text: "Add a dashboard" },
          ],
          response_metadata: { next_cursor: "" },
        });
      if (url.pathname.endsWith("users.info"))
        return response({
          ok: true,
          user: {
            real_name: "Client",
            profile: { email: "client@example.com" },
          },
        });
      throw new Error(`Unexpected Slack request ${url}`);
    });
    const result = await createSlackConnector(fetcher as typeof fetch).sync(
      {
        projectId: "10000000-0000-4000-8000-000000000001",
        channelIds: ["C123"],
        excludeInternalDomains: [],
        includeBotMessages: false,
      },
      { "bot-token": "xoxb-test" },
      { channels: { C123: "1710000000.000001" } },
    );
    expect(result.messages).toHaveLength(1);
    expect(result.checkpoint).toEqual({
      channels: { C123: "1720000000.000001" },
    });
  });

  it("normalizes Gmail source evidence and advances history sync", async () => {
    const encoded = Buffer.from("Can we add custom exports?").toString(
      "base64url",
    );
    const gmailMessage = {
      id: "m1",
      threadId: "t1",
      internalDate: "1720000000000",
      payload: {
        headers: [
          { name: "From", value: "Client <client@example.com>" },
          { name: "Subject", value: "Exports" },
        ],
        mimeType: "text/plain",
        body: { data: encoded },
      },
    };
    expect(normalizeGmailMessage(gmailMessage)).toMatchObject({
      externalId: "m1",
      externalThreadId: "t1",
      senderEmail: "client@example.com",
      text: "Can we add custom exports?",
    });
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/history?"))
        return response({
          history: [{ messagesAdded: [{ message: { id: "m1" } }] }],
          historyId: "101",
        });
      if (url.includes("/messages/m1")) return response(gmailMessage);
      if (url.endsWith("/profile"))
        return response({
          emailAddress: "owner@example.com",
          historyId: "102",
        });
      throw new Error(`Unexpected Gmail request ${url}`);
    });
    const result = await createGoogleConnector(fetcher as typeof fetch).sync(
      {
        projectId: "10000000-0000-4000-8000-000000000001",
        clientId: "google-client-id",
        query: "",
        labelIds: [],
        excludeInternalDomains: [],
      },
      { "access-token": "token" },
      { historyId: "100" },
    );
    expect(result.messages).toHaveLength(1);
    expect(result.checkpoint.historyId).toBe("102");
  });

  it("normalizes Outlook mail and stores the Graph delta link", async () => {
    const message = {
      id: "mail-1",
      conversationId: "conversation-1",
      subject: "Portal",
      body: { content: "<p>Please add a portal.</p>" },
      from: { emailAddress: { name: "Client", address: "client@example.com" } },
      receivedDateTime: "2026-07-22T12:00:00Z",
    };
    expect(normalizeGraphMail(message)).toMatchObject({
      externalId: "mail:mail-1",
      externalThreadId: "mail:conversation-1",
      text: "Please add a portal.",
    });
    const deltaLink =
      "https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=next";
    const fetcher = vi.fn(async () =>
      response({ value: [message], "@odata.deltaLink": deltaLink }),
    );
    const result = await createMicrosoftConnector(fetcher as typeof fetch).sync(
      {
        projectId: "10000000-0000-4000-8000-000000000001",
        clientId: "microsoft-client-id",
        tenantId: "common",
        mailboxFolder: "inbox",
        teamsChannels: [],
        excludeInternalDomains: [],
      },
      { "access-token": "token" },
      {},
    );
    expect(result.messages).toHaveLength(1);
    expect(result.checkpoint.mailDeltaLink).toBe(deltaLink);
  });

  it("builds provider-specific OAuth endpoints and least-purpose scopes", () => {
    const google = oauthProviderDefinition("Google", {});
    expect(google.authorizeUrl).toContain("accounts.google.com");
    expect(google.scopes).toContain(
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    const microsoft = oauthProviderDefinition("Microsoft", {
      tenantId: "tenant-1",
    });
    expect(microsoft.authorizeUrl).toContain("tenant-1");
    expect(microsoft.scopes).toContain("Mail.Read");
  });

  it("rejects provider pagination links that could leak bearer tokens", () => {
    expect(
      assertProviderUrl(
        "https://graph.microsoft.com/v1.0/me/messages?$skiptoken=next",
        "graph.microsoft.com",
      ),
    ).toContain("graph.microsoft.com");
    expect(() =>
      assertProviderUrl(
        "https://attacker.example/collect",
        "graph.microsoft.com",
      ),
    ).toThrow(/unsafe continuation/);
  });
});
