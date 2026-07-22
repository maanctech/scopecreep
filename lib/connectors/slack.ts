import { z } from "zod";
import { providerJson } from "@/lib/connectors/http";
import type {
  CommunicationConnector,
  ConnectorHttp,
  ConnectorSyncResult,
} from "@/lib/connectors/types";

export const slackConfigurationSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    channelIds: z.array(z.string().trim().min(1).max(40)).min(1).max(50),
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
    includeBotMessages: z.boolean().default(false),
    botToken: z.string().trim().min(20).max(500),
  })
  .strict();

export type SlackConfiguration = Omit<
  z.infer<typeof slackConfigurationSchema>,
  "name" | "botToken"
>;

type SlackResponse<T> = T & {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
};

type SlackMessage = {
  ts?: string;
  thread_ts?: string;
  user?: string;
  bot_id?: string;
  text?: string;
  subtype?: string;
  deleted_ts?: string;
  edited?: { ts?: string };
  reply_count?: number;
};

function slackDate(value?: string) {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

async function slackApi<T>(
  fetcher: ConnectorHttp,
  token: string,
  method: string,
  parameters: Record<string, string> = {},
) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [name, value] of Object.entries(parameters))
    if (value) url.searchParams.set(name, value);
  const { data } = await providerJson<SlackResponse<T>>(
    fetcher,
    url.toString(),
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!data.ok)
    throw new Error(
      `Slack rejected ${method}: ${data.error || "unknown error"}.`,
    );
  return data;
}

export function normalizeSlackMessage(
  message: SlackMessage,
  channelId: string,
  sender: { name: string | null; email: string | null },
) {
  const deletedId = message.deleted_ts;
  const externalId = deletedId || message.ts;
  if (!externalId) return null;
  return {
    externalId,
    externalThreadId: message.thread_ts || message.ts || deletedId || null,
    sender: sender.name,
    senderEmail: sender.email,
    recipients: [],
    timestamp: slackDate(message.ts || deletedId),
    editedTimestamp: slackDate(message.edited?.ts),
    deletedTimestamp: deletedId ? slackDate(message.ts || deletedId) : null,
    subject: `Slack channel ${channelId}`,
    text: deletedId ? "Message deleted at source." : message.text?.trim() || "",
    rawMetadata: {
      channelId,
      subtype: message.subtype || null,
      botMessage: Boolean(message.bot_id),
    },
  };
}

export function createSlackConnector(
  fetcher: ConnectorHttp = fetch,
): CommunicationConnector<SlackConfiguration> {
  return {
    provider: "Slack",
    async test(configuration, secrets) {
      const token = secrets["bot-token"];
      if (!token) throw new Error("Slack bot token is missing.");
      const account = await slackApi<{ team?: string; user?: string }>(
        fetcher,
        token,
        "auth.test",
      );
      for (const channel of configuration.channelIds)
        await slackApi(fetcher, token, "conversations.info", { channel });
      return {
        ok: true,
        accountLabel: account.team || account.user || "Slack workspace",
        details: `${configuration.channelIds.length} selected channel${configuration.channelIds.length === 1 ? "" : "s"} verified.`,
      };
    },
    async sync(configuration, secrets, checkpoint) {
      const token = secrets["bot-token"];
      if (!token) throw new Error("Slack bot token is missing.");
      const previous = (checkpoint.channels || {}) as Record<string, string>;
      const next: Record<string, string> = { ...previous };
      const result: ConnectorSyncResult = {
        messages: [],
        checkpoint: { channels: next },
        warnings: [],
      };
      const users = new Map<
        string,
        { name: string | null; email: string | null }
      >();
      async function user(userId?: string) {
        if (!userId) return { name: null, email: null };
        const cached = users.get(userId);
        if (cached) return cached;
        const response = await slackApi<{
          user?: {
            real_name?: string;
            name?: string;
            profile?: { email?: string };
          };
        }>(fetcher, token, "users.info", { user: userId });
        const value = {
          name: response.user?.real_name || response.user?.name || userId,
          email: response.user?.profile?.email?.toLowerCase() || null,
        };
        users.set(userId, value);
        return value;
      }
      for (const channel of configuration.channelIds) {
        let cursor = "";
        let newest = previous[channel] || "0";
        do {
          const page = await slackApi<{ messages?: SlackMessage[] }>(
            fetcher,
            token,
            "conversations.history",
            {
              channel,
              oldest: previous[channel] || "0",
              inclusive: "false",
              limit: "200",
              cursor,
            },
          );
          for (const message of page.messages || []) {
            newest =
              Number(message.ts || 0) > Number(newest) ? message.ts! : newest;
            const sender = await user(message.user);
            const domain = sender.email?.split("@")[1];
            if (
              (message.bot_id && !configuration.includeBotMessages) ||
              (domain && configuration.excludeInternalDomains.includes(domain))
            )
              continue;
            const normalized = normalizeSlackMessage(message, channel, sender);
            if (normalized?.text) result.messages.push(normalized);
            if (message.reply_count && message.ts) {
              const replies = await slackApi<{ messages?: SlackMessage[] }>(
                fetcher,
                token,
                "conversations.replies",
                { channel, ts: message.ts, limit: "200" },
              );
              for (const reply of (replies.messages || []).slice(1)) {
                const replySender = await user(reply.user);
                const replyDomain = replySender.email?.split("@")[1];
                if (
                  (reply.bot_id && !configuration.includeBotMessages) ||
                  (replyDomain &&
                    configuration.excludeInternalDomains.includes(replyDomain))
                )
                  continue;
                const item = normalizeSlackMessage(reply, channel, replySender);
                if (item?.text) result.messages.push(item);
              }
            }
          }
          cursor = page.response_metadata?.next_cursor || "";
        } while (cursor);
        next[channel] = newest;
      }
      return result;
    },
  };
}
