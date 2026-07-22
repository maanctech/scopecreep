"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseBackup } from "lucide-react";

export function BackupPanel({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: string; success?: string }>({});

  async function create() {
    setBusy(true);
    setNotice({});
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      const body = await response.json() as { error?: string; backup?: { path: string; complete: boolean } };
      if (!response.ok) throw new Error(body.error || "Backup creation failed.");
      setNotice({ success: `Complete backup saved to ${body.backup?.path}.` });
      router.refresh();
    } catch (error) {
      setNotice({ error: error instanceof Error ? error.message : "Backup creation failed." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={create}
        disabled={!canCreate || busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        <DatabaseBackup className="h-4 w-4" aria-hidden="true" />
        {busy ? "Creating verified backup..." : "Create installation backup"}
      </button>
      {!canCreate ? <p className="mt-2 text-sm text-zinc-600">A system administrator must create installation backups.</p> : null}
      <div aria-live="polite" className="mt-3 text-sm">
        {notice.error ? <p className="text-red-800">{notice.error}</p> : null}
        {notice.success ? <p className="text-emerald-800">{notice.success}</p> : null}
      </div>
    </div>
  );
}
