"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <SignOutButton redirectUrl="/">
      <button
        className="
          inline-flex h-10 items-center gap-2 rounded-md border
          border-audit-border px-3 text-sm font-medium
          hover:bg-audit-soft
        "
        type="button"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </SignOutButton>
  );
}
