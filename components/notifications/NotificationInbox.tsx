"use client";

import { useRouter } from "next/navigation";
import { CheckCheck, Mail } from "lucide-react";
import { useState } from "react";
import type { ProfessionalNotification } from "@/lib/notifications/types";

export function NotificationInbox({
  initialNotifications,
  initialDigestEnabled,
  initialDelivery,
}: {
  initialNotifications: ProfessionalNotification[];
  initialDigestEnabled: boolean;
  initialDelivery: {
    status: string;
    error: string | null;
    completed_at: string | null;
  } | null;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [digestEnabled, setDigestEnabled] = useState(initialDigestEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const unread = notifications.filter((item) => !item.read_at).length;

  async function request(url: string, method: "POST" | "PUT", body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) throw new Error(data.error || "The update failed.");
  }

  async function read(item: ProfessionalNotification) {
    if (item.read_at) return;

    await request(`/api/notifications/${item.id}/read`, "POST");
    setNotifications((current) =>
      current.map((row) =>
        row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row,
      ),
    );
    router.refresh();
  }

  async function readAll() {
    setBusy(true);
    setMessage(null);

    try {
      await request("/api/notifications/read-all", "POST");
      const now = new Date().toISOString();

      setNotifications((current) => current.map((row) => ({ ...row, read_at: row.read_at || now })));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDigest() {
    const next = !digestEnabled;

    setBusy(true);
    setMessage(null);

    try {
      await request("/api/notifications/preferences", "PUT", {
        daily_digest_enabled: next,
      });
      setDigestEnabled(next);
      setMessage(next ? "Daily professional digest enabled." : "Daily digest disabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update email settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="
      grid gap-7
      lg:grid-cols-[minmax(0,1fr)_19rem]
    ">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Items requiring attention</h2>
            <p className="mt-1 text-sm text-zinc-600">{unread} unread</p>
          </div>
          <button
            type="button"
            onClick={readAll}
            disabled={busy || unread === 0}
            className="
              inline-flex min-h-11 items-center gap-2 rounded-md border
              border-zinc-400 px-4 text-sm font-semibold
              disabled:opacity-50
            "
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Mark all read
          </button>
        </div>
        <div className="
          mt-4 divide-y divide-audit-border border-y border-audit-border
          bg-white
        ">
          {notifications.length ? (
            notifications.map((item) => (
              <article key={item.id} className={item.read_at ? "p-5" : `
                border-l-4 border-l-ink p-5
              `}>
                <div className="
                  flex flex-wrap items-start justify-between gap-3
                ">
                  <div className="min-w-0">
                    <p className="
                      text-xs font-semibold text-audit-muted uppercase
                    ">{item.notification_type}</p>
                    <h3 className="mt-1 font-semibold">{item.title}</h3>
                    {item.project_name ? (
                      <p className="mt-1 text-sm text-zinc-600">
                        {item.client_name} / {item.project_name}
                      </p>
                    ) : null}
                  </div>
                  <time className="text-xs text-zinc-500" dateTime={item.created_at}>
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-3 text-sm/6 text-zinc-700">{item.detail}</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await read(item);
                      router.push(item.href);
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to open this review item.",
                      );
                    }
                  }}
                  className="
                    mt-4 inline-flex min-h-10 items-center text-sm font-semibold
                    underline
                  "
                >
                  Review item
                </button>
              </article>
            ))
          ) : (
            <div className="p-8 text-center">
              <h3 className="font-semibold">No review alerts</h3>
              <p className="mt-2 text-sm text-zinc-600">
                New findings and monitoring failures will appear here.
              </p>
            </div>
          )}
        </div>
      </section>
      <aside className="border-l border-audit-border pl-6">
        <Mail className="size-5" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-semibold">Daily email digest</h2>
        <p className="mt-2 text-sm/6 text-zinc-700">
          Receive one summary at the professional email on your account. Message and SOW
          bodies are never included.
        </p>
        <label className="mt-5 flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={() => void toggleDigest()}
            disabled={busy}
            className="size-4"
          />
          Enable daily digest
        </label>
        {message ? <p className="mt-4 text-sm text-zinc-700" role="status">{message}</p> : null}
        {initialDelivery?.status === "Failed" ? (
          <div className="
            mt-5 border-l-4 border-l-red-700 pl-3 text-sm text-red-900
          ">
            <p className="font-semibold">Last digest failed</p>
            <p className="mt-1">{initialDelivery.error}</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
