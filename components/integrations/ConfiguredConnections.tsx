"use client";

import type { IntegrationConnection } from "@/lib/connectors/service";
import type { ConnectorStatus } from "@/lib/connectors/types";

type Connection = IntegrationConnection;

function statusClass(status: ConnectorStatus) {
  if (status === "Connected")
    return "border-emerald-300 bg-emerald-50 text-emerald-900";

  if (status === "Needs Attention")
    return "border-red-300 bg-red-50 text-red-900";

  if (status === "Syncing") return "border-blue-300 bg-blue-50 text-blue-900";

  return "border-zinc-300 bg-zinc-50 text-zinc-800";
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
      <p className="mt-2 text-sm text-zinc-700">
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
              className="
                rounded-md border border-audit-border bg-white p-5 shadow-audit
              "
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{connection.name}</h3>
                  <p className="mt-1 text-sm text-zinc-600">
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
                <p className="
                  mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm
                  text-red-900
                ">
                  {String(connection.last_error)}
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
                      className="
                        min-h-11 rounded-md bg-ink px-4 text-sm font-semibold
                        text-white
                        disabled:opacity-60
                      "
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
                          min-h-11 rounded-md border border-zinc-400 px-4
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
                          min-h-11 rounded-md border border-zinc-400 px-4
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
                        min-h-11 px-3 text-sm font-semibold text-red-800
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
          <div className="
            rounded-md border border-audit-border bg-white p-5 text-zinc-700
          ">
            No connections configured. Manual and transcript import are
            available immediately.
          </div>
        )}
      </div>
    </section>
  );
}
