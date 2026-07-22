"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md border border-audit-border px-3 text-sm font-medium hover:bg-audit-soft disabled:opacity-60"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      type="button"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
