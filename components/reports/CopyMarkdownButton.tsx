"use client";

import { useState } from "react";
import { Clipboard } from "lucide-react";

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="sl-button-primary min-h-10 px-3"
      >
        <Clipboard className="size-4" aria-hidden="true" />
        Copy markdown
      </button>
      {status === "copied" ? <span className="text-sm text-signal">Copied.</span> : null}
      {status === "error" ? (
        <span className="text-sm text-critical">Copy failed. Select the report text manually.</span>
      ) : null}
    </div>
  );
}
