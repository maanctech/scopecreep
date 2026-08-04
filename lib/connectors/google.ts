import { z } from "zod";
import { providerJson } from "@/lib/connectors/http";
import type {
  CommunicationConnector,
  ConnectorHttp,
  ConnectorSyncResult,
} from "@/lib/connectors/types";

export const googleConfigurationSchema = z
  .object({
    projectId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    clientId: z.string().trim().min(10).max(500),
    clientSecret: z.string().trim().min(8).max(1000),
    query: z.string().trim().max(500).default(""),
    labelIds: z.array(z.string().trim().min(1).max(100)).max(25).default([]),
    excludeInternalDomains: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9.-]+$/),
      )
      .max(50)
      .default([]),
  })
  .strict();

export type GoogleConfiguration = Omit<
  z.infer<typeof googleConfigurationSchema>,
  "name" | "clientSecret"
>;

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailPart & {
    headers?: Array<{ name: string; value: string }>;
  };
};

function gmailApi<T>(fetcher: ConnectorHttp, token: string, url: string) {
  return providerJson<T>(fetcher, url, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((result) => result.data);
}

function decodeBase64Url(value?: string) {
  return value ? Buffer.from(value, "base64url").toString("utf8") : "";
}

function plainText(part?: GmailPart): string {
  if (!part) return "";

  if (part.mimeType === "text/plain" && part.body?.data)
    return decodeBase64Url(part.body.data).trim();

  for (const child of part.parts || []) {
    const value = plainText(child);

    if (value) return value;
  }

  return "";
}

function addresses(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeGmailMessage(message: GmailMessage) {
  const headers = Object.fromEntries(
    (message.payload?.headers || []).map((header) => [
      header.name.toLowerCase(),
      header.value,
    ]),
  );
  const senderValue = headers.from || "";
  const senderEmail = senderValue.match(/<([^>]+)>/)?.[1] || senderValue;
  const text = plainText(message.payload) || message.snippet?.trim() || "";

  return {
    externalId: message.id,
    externalThreadId: message.threadId || message.id,
    sender: senderValue || null,
    senderEmail: senderEmail.includes("@") ? senderEmail.toLowerCase() : null,
    recipients: [
      ...addresses(headers.to || ""),
      ...addresses(headers.cc || ""),
    ],
    timestamp: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : null,
    editedTimestamp: null,
    deletedTimestamp: null,
    subject: headers.subject || null,
    text,
    rawMetadata: { labelIds: message.labelIds || [] },
  };
}

export function createGoogleConnector(
  fetcher: ConnectorHttp = fetch,
): CommunicationConnector<GoogleConfiguration> {
  return {
    provider: "Google",
    async test(_configuration, secrets) {
      const token = secrets["access-token"];

      if (!token) throw new Error("Google authorization is required.");

      const profile = await gmailApi<{
        emailAddress?: string;
        messagesTotal?: number;
      }>(
        fetcher,
        token,
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      );

      return {
        ok: true,
        accountLabel: profile.emailAddress || "Google mailbox",
        details: "Gmail read-only access verified.",
      };
    },
    async sync(configuration, secrets, checkpoint) {
      const token = secrets["access-token"];

      if (!token) throw new Error("Google authorization is required.");

      const result: ConnectorSyncResult = {
        messages: [],
        checkpoint: {},
        warnings: [],
      };
      const ids = new Set<string>();
      const deleted = new Set<string>();

      if (checkpoint.historyId) {
        let pageToken = "";

        do {
          const url = new URL(
            "https://gmail.googleapis.com/gmail/v1/users/me/history",
          );

          url.searchParams.set("startHistoryId", String(checkpoint.historyId));
          url.searchParams.append("historyTypes", "messageAdded");
          url.searchParams.append("historyTypes", "messageDeleted");

          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const page = await gmailApi<{
            history?: Array<{
              messagesAdded?: Array<{ message: { id: string } }>;
              messagesDeleted?: Array<{ message: { id: string } }>;
            }>;
            historyId?: string;
            nextPageToken?: string;
          }>(fetcher, token, url.toString());

          for (const history of page.history || []) {
            for (const item of history.messagesAdded || [])
              ids.add(item.message.id);

            for (const item of history.messagesDeleted || [])
              deleted.add(item.message.id);
          }

          if (page.historyId) result.checkpoint.historyId = page.historyId;

          pageToken = page.nextPageToken || "";
        } while (pageToken);
      } else {
        let pageToken = "";

        do {
          const url = new URL(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
          );

          url.searchParams.set("maxResults", "100");

          if (configuration.query)
            url.searchParams.set("q", configuration.query);

          for (const label of configuration.labelIds)
            url.searchParams.append("labelIds", label);

          if (pageToken) url.searchParams.set("pageToken", pageToken);

          const page = await gmailApi<{
            messages?: Array<{ id: string }>;
            nextPageToken?: string;
          }>(fetcher, token, url.toString());

          for (const item of page.messages || []) ids.add(item.id);

          pageToken = page.nextPageToken || "";
        } while (pageToken && ids.size < 5_000);

        if (ids.size >= 5_000)
          result.warnings.push("Initial Gmail sync stopped at 5,000 messages.");
      }

      for (const id of ids) {
        const message = await gmailApi<GmailMessage>(
          fetcher,
          token,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        );
        const normalized = normalizeGmailMessage(message);
        const domain = normalized.senderEmail?.split("@")[1];

        if (
          normalized.text &&
          (!domain || !configuration.excludeInternalDomains.includes(domain))
        )
          result.messages.push(normalized);
      }

      for (const id of deleted)
        result.messages.push({
          externalId: id,
          externalThreadId: null,
          sender: null,
          senderEmail: null,
          recipients: [],
          timestamp: null,
          editedTimestamp: null,
          deletedTimestamp: new Date().toISOString(),
          subject: null,
          text: "Message deleted at source.",
          rawMetadata: { historyDeletion: true },
        });

      const profile = await gmailApi<{ historyId?: string }>(
        fetcher,
        token,
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      );

      if (profile.historyId) result.checkpoint.historyId = profile.historyId;

      return result;
    },
    async revoke(_configuration, secrets) {
      const token = secrets["refresh-token"] || secrets["access-token"];

      if (!token) return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      try {
        await fetcher("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
