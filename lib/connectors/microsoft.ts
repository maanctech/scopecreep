import { z } from "zod";
import { assertProviderUrl, providerJson } from "@/lib/connectors/http";
import type {
  CommunicationConnector,
  ConnectorHttp,
  ConnectorSyncResult,
} from "@/lib/connectors/types";

const teamsChannelSchema = z.object({
  teamId: z.string().trim().min(1).max(200),
  channelId: z.string().trim().min(1).max(300),
  label: z.string().trim().min(1).max(120),
});

export const microsoftConfigurationSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    clientId: z.string().trim().min(10).max(500),
    clientSecret: z.string().trim().min(8).max(1000),
    tenantId: z.string().trim().min(1).max(200).default("common"),
    mailboxFolder: z.string().trim().min(1).max(200).default("inbox"),
    teamsChannels: z.array(teamsChannelSchema).max(25).default([]),
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

export type MicrosoftConfiguration = Omit<
  z.infer<typeof microsoftConfigurationSchema>,
  "name" | "clientSecret"
>;

type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string; contentType?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  sender?: {
    user?: { displayName?: string; userIdentityType?: string; id?: string };
  };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string } }>;
  receivedDateTime?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  replyToId?: string;
  ["@removed"]?: { reason?: string };
};

function graphApi<T>(fetcher: ConnectorHttp, token: string, url: string) {
  return providerJson<T>(
    fetcher,
    assertProviderUrl(url, "graph.microsoft.com"),
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((result) => result.data);
}

function plain(value?: string) {
  return (value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function normalizeGraphMail(message: GraphMessage) {
  const sender = message.from?.emailAddress;
  return {
    externalId: `mail:${message.id}`,
    externalThreadId: message.conversationId
      ? `mail:${message.conversationId}`
      : `mail:${message.id}`,
    sender: sender?.name || sender?.address || null,
    senderEmail: sender?.address?.toLowerCase() || null,
    recipients: [
      ...(message.toRecipients || []),
      ...(message.ccRecipients || []),
    ]
      .map((item) => item.emailAddress?.address)
      .filter((value): value is string => Boolean(value)),
    timestamp: message.receivedDateTime || null,
    editedTimestamp: message.lastModifiedDateTime || null,
    deletedTimestamp: message["@removed"] ? new Date().toISOString() : null,
    subject: message.subject || null,
    text: message["@removed"]
      ? "Message deleted at source."
      : plain(message.body?.content) || message.bodyPreview?.trim() || "",
    rawMetadata: { source: "Outlook" },
  };
}

function normalizeTeamsMessage(
  message: GraphMessage,
  channel: { teamId: string; channelId: string; label: string },
  rootId?: string,
) {
  const id = `teams:${channel.teamId}:${channel.channelId}:${message.id}`;
  return {
    externalId: id,
    externalThreadId: `teams:${channel.teamId}:${channel.channelId}:${rootId || message.replyToId || message.id}`,
    sender:
      message.from?.emailAddress?.name ||
      message.sender?.user?.displayName ||
      null,
    senderEmail: message.from?.emailAddress?.address?.toLowerCase() || null,
    recipients: [],
    timestamp: message.createdDateTime || null,
    editedTimestamp: message.lastModifiedDateTime || null,
    deletedTimestamp: message["@removed"] ? new Date().toISOString() : null,
    subject: `Teams: ${channel.label}`,
    text: message["@removed"]
      ? "Message deleted at source."
      : plain(message.body?.content),
    rawMetadata: {
      source: "Teams",
      teamId: channel.teamId,
      channelId: channel.channelId,
    },
  };
}

export function createMicrosoftConnector(
  fetcher: ConnectorHttp = fetch,
): CommunicationConnector<MicrosoftConfiguration> {
  return {
    provider: "Microsoft",
    async test(_configuration, secrets) {
      const token = secrets["access-token"];
      if (!token) throw new Error("Microsoft authorization is required.");
      const account = await graphApi<{
        displayName?: string;
        userPrincipalName?: string;
      }>(
        fetcher,
        token,
        "https://graph.microsoft.com/v1.0/me?$select=displayName,userPrincipalName",
      );
      return {
        ok: true,
        accountLabel:
          account.userPrincipalName ||
          account.displayName ||
          "Microsoft account",
        details: "Microsoft Graph access verified.",
      };
    },
    async sync(configuration, secrets, checkpoint) {
      const token = secrets["access-token"];
      if (!token) throw new Error("Microsoft authorization is required.");
      const result: ConnectorSyncResult = {
        messages: [],
        checkpoint: {},
        warnings: [],
      };
      let mailUrl = checkpoint.mailDeltaLink
        ? String(checkpoint.mailDeltaLink)
        : `https://graph.microsoft.com/v1.0/me/mailFolders/${encodeURIComponent(configuration.mailboxFolder)}/messages/delta?$top=100&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,lastModifiedDateTime`;
      while (mailUrl) {
        const page = await graphApi<{
          value?: GraphMessage[];
          ["@odata.nextLink"]?: string;
          ["@odata.deltaLink"]?: string;
        }>(fetcher, token, mailUrl);
        for (const message of page.value || []) {
          const normalized = normalizeGraphMail(message);
          const domain = normalized.senderEmail?.split("@")[1];
          if (
            normalized.text &&
            (!domain || !configuration.excludeInternalDomains.includes(domain))
          )
            result.messages.push(normalized);
        }
        if (page["@odata.deltaLink"])
          result.checkpoint.mailDeltaLink = page["@odata.deltaLink"];
        mailUrl = page["@odata.nextLink"] || "";
      }
      const teamsCheckpoint = (checkpoint.teams || {}) as Record<
        string,
        string
      >;
      const nextTeams = { ...teamsCheckpoint };
      for (const channel of configuration.teamsChannels) {
        const key = `${channel.teamId}:${channel.channelId}`;
        const base = `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent(channel.teamId)}/channels/${encodeURIComponent(channel.channelId)}`;
        let url = `${base}/messages?$top=50`;
        let latest = teamsCheckpoint[key] || "";
        while (url) {
          const page = await graphApi<{
            value?: GraphMessage[];
            ["@odata.nextLink"]?: string;
          }>(fetcher, token, url);
          for (const message of page.value || []) {
            if (
              teamsCheckpoint[key] &&
              message.lastModifiedDateTime &&
              message.lastModifiedDateTime <= teamsCheckpoint[key]
            )
              continue;
            const normalized = normalizeTeamsMessage(message, channel);
            const domain = normalized.senderEmail?.split("@")[1];
            if (
              normalized.text &&
              (!domain ||
                !configuration.excludeInternalDomains.includes(domain))
            )
              result.messages.push(normalized);
            if (message.id) {
              const replies = await graphApi<{ value?: GraphMessage[] }>(
                fetcher,
                token,
                `${base}/messages/${encodeURIComponent(message.id)}/replies?$top=100`,
              );
              for (const reply of replies.value || []) {
                const item = normalizeTeamsMessage(reply, channel, message.id);
                if (item.text) result.messages.push(item);
              }
            }
            if (
              message.lastModifiedDateTime &&
              message.lastModifiedDateTime > latest
            )
              latest = message.lastModifiedDateTime;
          }
          url = page["@odata.nextLink"] || "";
        }
        nextTeams[key] = latest;
      }
      result.checkpoint.teams = nextTeams;
      return result;
    },
  };
}
