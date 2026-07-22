"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntegrationConnection } from "@/lib/connectors/service";

type Connection = IntegrationConnection;

const catalog = [
  ["Manual Import", "Paste or upload text, CSV, and JSON", "Available"],
  [
    "Transcript Import",
    "Upload VTT, SRT, or pasted transcript cues",
    "Available",
  ],
  [
    "Signed Webhook",
    "Send normalized JSON through an HMAC-signed endpoint",
    "Available",
  ],
  [
    "IMAP Email",
    "Read a routed mailbox or folder over TLS",
    "Bring Your Own Credentials",
  ],
  [
    "Slack",
    "Read selected channels and thread replies",
    "Bring Your Own Credentials",
  ],
  [
    "Google Gmail",
    "Read a filtered mailbox with OAuth",
    "Bring Your Own Credentials",
  ],
  [
    "Microsoft 365",
    "Read Outlook and selected Teams channels with OAuth",
    "Bring Your Own Credentials",
  ],
] as const;

function statusClass(status: string) {
  if (status === "Connected")
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "Needs Attention")
    return "border-red-300 bg-red-50 text-red-900";
  if (status === "Syncing") return "border-blue-300 bg-blue-50 text-blue-900";
  return "border-zinc-300 bg-zinc-50 text-zinc-800";
}

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
      {notice.error ? (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900"
        >
          {notice.error}
        </div>
      ) : null}
      {notice.success ? (
        <div
          role="status"
          className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-900"
        >
          {notice.success}
        </div>
      ) : null}
      {oneTimeSecret ? (
        <section className="rounded-md border-2 border-amber-400 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold">One-time webhook secret</h2>
          <p className="mt-2 text-sm text-amber-950">
            This value will not be shown again. Store it in the sending
            system&apos;s secret manager.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="font-semibold">Endpoint</dt>
              <dd className="mt-1 break-all font-mono">
                {oneTimeSecret.endpoint}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Signing secret</dt>
              <dd className="mt-1 break-all font-mono">
                {oneTimeSecret.secret}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section>
        <h2 className="text-xl font-semibold">Connection methods</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map(([name, purpose, availability]) => (
            <article
              key={name}
              className="rounded-md border border-audit-border bg-white p-5 shadow-audit"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{name}</h3>
                <span className="text-xs font-semibold text-zinc-600">
                  {availability}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{purpose}</p>
              {name.includes("Import") ? (
                <Link
                  href="/app/import"
                  className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold underline"
                >
                  Open import
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Configured connections</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Tests use the provider directly. No connection is marked connected
          from saved values alone.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {initialConnections.length ? (
            initialConnections.map((connection) => (
              <article
                key={connection.id}
                className="rounded-md border border-audit-border bg-white p-5 shadow-audit"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{connection.name}</h3>
                    <p className="mt-1 text-sm text-zinc-600">
                      {connection.provider}
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-semibold ${statusClass(connection.status)}`}
                  >
                    {connection.status}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-600">Sync scope</dt>
                    <dd className="mt-1 font-medium">
                      {String(connection.sync_scope || "Not specified")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Last successful sync</dt>
                    <dd className="mt-1 font-medium">
                      {connection.last_synced_at
                        ? new Date(
                            String(connection.last_synced_at),
                          ).toLocaleString()
                        : "Never"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-600">Data permissions</dt>
                    <dd className="mt-1 font-medium">
                      {Array.isArray(connection.data_permissions)
                        ? connection.data_permissions.join(", ")
                        : "Not specified"}
                    </dd>
                  </div>
                </dl>
                {connection.last_error ? (
                  <p className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    {String(connection.last_error)}
                  </p>
                ) : null}
                {canManage && connection.status !== "Disabled" ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Google", "Microsoft"].includes(connection.provider) &&
                    connection.status === "Credentials Required" ? (
                      <button
                        type="button"
                        onClick={() => action(connection, "authorize")}
                        disabled={Boolean(busy)}
                        className="min-h-11 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Authorize
                      </button>
                    ) : null}
                    {["IMAP", "Slack", "Google", "Microsoft"].includes(
                      connection.provider,
                    ) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => action(connection, "test")}
                          disabled={Boolean(busy)}
                          className="min-h-11 rounded-md border border-zinc-400 px-4 text-sm font-semibold disabled:opacity-60"
                        >
                          Test connection
                        </button>
                        <button
                          type="button"
                          onClick={() => action(connection, "sync")}
                          disabled={
                            Boolean(busy) || connection.status !== "Connected"
                          }
                          className="min-h-11 rounded-md border border-zinc-400 px-4 text-sm font-semibold disabled:opacity-50"
                        >
                          Sync now
                        </button>
                      </>
                    ) : null}
                    {connection.provider !== "Manual" ? (
                      <button
                        type="button"
                        onClick={() => action(connection, "disable")}
                        disabled={Boolean(busy)}
                        className="min-h-11 px-3 text-sm font-semibold text-red-800 underline disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-md border border-audit-border bg-white p-5 text-zinc-700">
              No connections configured. Manual and transcript import are
              available immediately.
            </div>
          )}
        </div>
      </section>

      {canManage ? (
        <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
          <h2 className="text-xl font-semibold">Configure a connection</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Credentials are encrypted before storage and are never returned.
            Google and Microsoft also require an app registration and OAuth
            approval.
          </p>
          {projects.length ? (
            <form
              onSubmit={configure}
              autoComplete="off"
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <label>
                <span className="text-sm font-medium">Method</span>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="mt-2 w-full rounded-md border border-audit-border p-3"
                >
                  <option>Slack</option>
                  <option value="Google">Google Gmail</option>
                  <option value="Microsoft">Microsoft 365</option>
                  <option>IMAP</option>
                  <option>Webhook</option>
                </select>
              </label>
              <label>
                <span className="text-sm font-medium">Project route</span>
                <select
                  name="projectId"
                  required
                  className="mt-2 w-full rounded-md border border-audit-border p-3"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="text-sm font-medium">Connection name</span>
                <input
                  name="name"
                  required
                  autoComplete="off"
                  className="mt-2 w-full rounded-md border border-audit-border p-3"
                />
              </label>
              {provider === "IMAP" ? (
                <>
                  <label>
                    <span className="text-sm font-medium">IMAP host</span>
                    <input
                      name="host"
                      required
                      className="mt-2 w-full rounded-md border border-audit-border p-3"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-medium">Port</span>
                    <input
                      name="port"
                      type="number"
                      defaultValue="993"
                      required
                      className="mt-2 w-full rounded-md border border-audit-border p-3"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-medium">Username</span>
                    <input
                      name="username"
                      required
                      autoComplete="off"
                      className="mt-2 w-full rounded-md border border-audit-border p-3"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-medium">Password</span>
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      className="mt-2 w-full rounded-md border border-audit-border p-3"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-medium">Folder</span>
                    <input
                      name="folder"
                      defaultValue="INBOX"
                      required
                      className="mt-2 w-full rounded-md border border-audit-border p-3"
                    />
                  </label>
                </>
              ) : null}
              {["Google", "Microsoft"].includes(provider) ? (
                <label>
                  <span className="text-sm font-medium">OAuth client ID</span>
                  <input
                    name="clientId"
                    required
                    autoComplete="off"
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {["Slack", "Google", "Microsoft"].includes(provider) ? (
                <label>
                  <span className="text-sm font-medium">
                    {provider === "Slack" ? "Bot token" : "OAuth client secret"}
                  </span>
                  <input
                    name="credential"
                    type="password"
                    required
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {provider === "Google" ? (
                <label className="md:col-span-2">
                  <span className="text-sm font-medium">
                    Gmail label IDs, comma-separated (optional)
                  </span>
                  <input
                    name="labelIds"
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {provider === "Microsoft" ? (
                <label className="md:col-span-2">
                  <span className="text-sm font-medium">
                    Teams channels (optional, one team ID | channel ID | label
                    per line)
                  </span>
                  <textarea
                    name="teamsChannels"
                    rows={3}
                    placeholder="team-id | channel-id | Client delivery"
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {provider === "Microsoft" ? (
                <label>
                  <span className="text-sm font-medium">Tenant ID</span>
                  <input
                    name="tenantId"
                    defaultValue="common"
                    required
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {["Slack", "Google", "Microsoft"].includes(provider) ? (
                <label className="md:col-span-2">
                  <span className="text-sm font-medium">
                    {provider === "Slack"
                      ? "Channel IDs, comma-separated"
                      : provider === "Google"
                        ? "Gmail search filter"
                        : "Outlook folder"}
                  </span>
                  <input
                    name="scope"
                    required={provider === "Slack"}
                    defaultValue={provider === "Microsoft" ? "inbox" : ""}
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              {["Slack", "Google", "Microsoft", "IMAP"].includes(provider) ? (
                <label className="md:col-span-2">
                  <span className="text-sm font-medium">
                    Excluded internal sender domains, comma-separated
                  </span>
                  <input
                    name="domains"
                    placeholder="yourfirm.com"
                    className="mt-2 w-full rounded-md border border-audit-border p-3"
                  />
                </label>
              ) : null}
              <button
                disabled={Boolean(busy)}
                className="min-h-11 rounded-md bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"
              >
                {busy === "configure"
                  ? "Saving securely..."
                  : "Save configuration"}
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-zinc-700">
              Create a project before configuring a source route.
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-md border border-audit-border bg-white p-5 text-sm">
          Your role can review connection health but cannot change credentials
          or run syncs.
        </p>
      )}
    </>
  );
}
