"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntegrationConnection } from "@/lib/connectors/service";
import { ConfiguredConnections } from "@/components/integrations/ConfiguredConnections";
import { ConnectionForm } from "@/components/integrations/ConnectionForm";
import { IntegrationCatalog } from "@/components/integrations/IntegrationCatalog";
import { IntegrationNotices } from "@/components/integrations/IntegrationNotices";

type Connection = IntegrationConnection;

export function IntegrationHub({
  initialConnections,
  projects,
  canManage,
  oauthNotice,
}: {
  initialConnections: Connection[];
  projects: Array<{ id: string; label: string }>;
  canManage: boolean;
  oauthNotice: string | null;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState("Slack");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error?: string; success?: string }>(
    oauthNotice === "authorization-complete"
      ? { success: "Authorization and provider connection test completed." }
      : oauthNotice === "authorization-failed"
        ? {
            error:
              "Authorization could not be completed. Review the provider setup and try again.",
          }
        : {},
  );
  const [oneTimeSecret, setOneTimeSecret] = useState<{
    endpoint: string;
    secret: string;
  } | null>(null);

  async function jsonRequest(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok)
      throw new Error(String(data.error || "The action failed."));

    return data;
  }

  async function configure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;

    setBusy("configure");
    setNotice({});
    setOneTimeSecret(null);
    const form = new FormData(formElement);
    const projectId = String(form.get("projectId"));
    const name = String(form.get("name"));
    const domains = String(form.get("domains") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      if (provider === "Webhook") {
        const data = await jsonRequest("/api/ingestion/webhook", {
          projectId,
          name,
        });
        const connection = data.connection as {
          endpoint: string;
          secret: string;
        };

        setOneTimeSecret(connection);
      } else if (provider === "IMAP") {
        await jsonRequest("/api/ingestion/email", {
          action: "configure",
          projectId,
          name,
          host: String(form.get("host")),
          port: Number(form.get("port") || 993),
          secure: true,
          username: String(form.get("username")),
          password: String(form.get("password")),
          folder: String(form.get("folder") || "INBOX"),
          allowedSenderDomains: domains,
        });
      } else {
        const body: Record<string, unknown> = {
          provider,
          projectId,
          name,
          excludeInternalDomains: domains,
        };

        if (provider === "Slack") {
          body.botToken = String(form.get("credential"));
          body.channelIds = String(form.get("scope"))
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
          body.includeBotMessages = false;
        } else if (provider === "Google") {
          body.clientId = String(form.get("clientId"));
          body.clientSecret = String(form.get("credential"));
          body.query = String(form.get("scope") || "");
          body.labelIds = String(form.get("labelIds") || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        } else {
          body.clientId = String(form.get("clientId"));
          body.clientSecret = String(form.get("credential"));
          body.tenantId = String(form.get("tenantId") || "common");
          body.mailboxFolder = String(form.get("scope") || "inbox");
          body.teamsChannels = String(form.get("teamsChannels") || "")
            .split(/\r?\n/)
            .map((line) => line.split("|").map((item) => item.trim()))
            .filter((parts) => parts.length === 3 && parts.every(Boolean))
            .map(([teamId, channelId, label]) => ({
              teamId,
              channelId,
              label,
            }));
        }

        await jsonRequest("/api/integrations", body);
      }

      setNotice({
        success:
          provider === "Webhook"
            ? "Webhook created. Save the one-time signing secret now; the connection remains unverified until its first valid delivery."
            : "Configuration saved. Test or authorize it before the first sync.",
      });
      formElement.reset();
      router.refresh();
    } catch (error) {
      setNotice({
        error: error instanceof Error ? error.message : "Configuration failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function action(
    connection: Connection,
    value: "authorize" | "test" | "sync" | "disable",
  ) {
    if (
      value === "disable" &&
      !window.confirm(
        "Disable this connection and remove its saved credentials? Imported audit records will remain.",
      )
    )
      return;

    setBusy(`${connection.id}:${value}`);
    setNotice({});

    try {
      const data =
        connection.provider === "IMAP" && ["test", "sync"].includes(value)
          ? await jsonRequest("/api/ingestion/email", {
              action: value,
              connectionId: connection.id,
            })
          : await jsonRequest(`/api/integrations/${connection.id}`, {
              action: value,
            });

      if (value === "authorize") {
        window.location.assign(String(data.authorizationUrl));

        return;
      }

      setNotice({
        success:
          value === "test"
            ? "Provider connection verified."
            : value === "sync"
              ? "Sync completed. Review the import job for counts."
              : "Connection disabled and credentials removed.",
      });
      router.refresh();
    } catch (error) {
      setNotice({
        error:
          error instanceof Error ? error.message : "Integration action failed.",
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <IntegrationNotices notice={notice} oneTimeSecret={oneTimeSecret} />
      <IntegrationCatalog />
      <ConfiguredConnections
        connections={initialConnections}
        canManage={canManage}
        busy={busy}
        onAction={action}
      />
      <ConnectionForm
        projects={projects}
        canManage={canManage}
        provider={provider}
        busy={busy}
        onProviderChange={setProvider}
        onSubmit={configure}
      />
    </>
  );
}
