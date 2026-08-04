"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="
        inline-flex h-11 items-center gap-2 rounded-md border
        border-audit-border px-4 text-sm font-semibold
        hover:bg-audit-soft
        print:hidden
      "
    >
      <Printer className="size-4" aria-hidden="true" />
      Print report
    </button>
  );
}
