"use client";

import type { IntegrationConnection } from "@/lib/connectors/service";

type Connection = IntegrationConnection;

function statusClass(status: string) {
  if (status === "Connected")
    return "border-signal/25 bg-signal/5 text-signal";

  if (status === "Needs Attention")
    return "border-critical/25 bg-critical/5 text-critical";

  if (status === "Syncing") return "border-signal/25 bg-signal/5 text-signal";

  return "border-audit-border bg-paper text-ink";
}

export function ConfiguredConnections({
  connections,
  canManage,
  busy,
  onAction,
}: {
  connections: Connection[];
  canManage: boolean;
  busy: string | null;
  onAction: (
    connection: Connection,
    value: "authorize" | "test" | "sync" | "disable",
  ) => void;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">Configured connections</h2>
      <p className="mt-2 text-sm text-audit-body">
        Tests use the provider directly. No connection is marked connected
        from saved values alone.
      </p>
      <div className="
        mt-4 grid gap-4
        lg:grid-cols-2
      ">
        {connections.length ? (
          connections.map((connection) => (
            <article
              key={connection.id}
              className="sl-panel p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{connection.name}</h3>
                  <p className="mt-1 text-sm text-audit-muted">
                    {connection.provider}
                  </p>
                </div>
                <span
                  className={`
                    rounded-sm border px-2 py-1 text-xs font-semibold
                    ${statusClass(connection.status)}
                  `}
                >
                  {connection.status}
                </span>
              </div>
              <dl className="
                mt-4 grid gap-3 text-sm
                sm:grid-cols-2
              ">
                <div>
                  <dt className="text-audit-muted">Sync scope</dt>
                  <dd className="mt-1 font-medium">
                    {String(connection.sync_scope || "Not specified")}
                  </dd>
                </div>
                <div>
                  <dt className="text-audit-muted">Last successful sync</dt>
                  <dd className="mt-1 font-medium">
                    {connection.last_synced_at
                      ? new Date(
                          String(connection.last_synced_at),
                        ).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
                <div>
                  <dt className="text-audit-muted">Monitoring</dt>
                  <dd className="mt-1 font-medium">
                    {connection.automation_desired_state
                      ? `${connection.automation_desired_state} / ${connection.automation_health_status}`
                      : "Not enabled"}
                    {connection.automation_next_run_at &&
                    connection.automation_desired_state === "Enabled" &&
                    connection.automation_health_status === "Healthy"
                      ? ` · next ${new Date(connection.automation_next_run_at).toLocaleString()}`
                      : ""}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-audit-muted">Data permissions</dt>
                  <dd className="mt-1 font-medium">
                    {Array.isArray(connection.data_permissions)
                      ? connection.data_permissions.join(", ")
                      : "Not specified"}
                  </dd>
                </div>
              </dl>
              {connection.last_error ? (
                <p className="
                  mt-4 rounded-sm border border-critical/25 bg-critical/5 p-3
                  text-sm text-critical
                ">
                  {String(connection.last_error)}
                </p>
              ) : null}
              {connection.automation_last_error &&
              connection.automation_last_error !== connection.last_error ? (
                <p className="
                  mt-3 rounded-sm border border-audit-amber/30 bg-audit-amber/5
                  p-3 text-sm text-audit-amber
                ">
                  Monitoring: {connection.automation_last_error}
                </p>
              ) : null}
              {canManage && connection.status !== "Disabled" ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Google", "Microsoft"].includes(connection.provider) &&
                  connection.status === "Credentials Required" ? (
                    <button
                      type="button"
                      onClick={() => onAction(connection, "authorize")}
                      disabled={Boolean(busy)}
                      className="sl-button-primary"
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
                        onClick={() => onAction(connection, "test")}
                        disabled={Boolean(busy)}
                        className="
                          min-h-11 rounded-md border border-audit-border px-4
                          text-sm font-semibold
                          disabled:opacity-60
                        "
                      >
                        Test connection
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction(connection, "sync")}
                        disabled={
                          Boolean(busy) || connection.status !== "Connected"
                        }
                        className="
                          min-h-11 rounded-md border border-audit-border px-4
                          text-sm font-semibold
                          disabled:opacity-50
                        "
                      >
                        Sync now
                      </button>
                    </>
                  ) : null}
                  {connection.provider !== "Manual" ? (
                    <button
                      type="button"
                      onClick={() => onAction(connection, "disable")}
                      disabled={Boolean(busy)}
                      className="
                        min-h-11 px-3 text-sm font-semibold text-critical
                        underline
                        disabled:opacity-50
                      "
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="sl-panel p-5 text-audit-body">
            No connections configured. Manual and transcript import are
            available immediately.
          </div>
        )}
      </div>
    </section>
  );
}
