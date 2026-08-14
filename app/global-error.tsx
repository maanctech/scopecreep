"use client";

import "./globals.css";
import { FailureNotice } from "@/components/ui/FailureNotice";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-2xl px-6 py-16">
          <FailureNotice
            title="ScopeLedger could not start this page"
            body="Nothing you have entered was changed or lost. Try again, and if it keeps happening, send us the reference below."
            reference={error.digest}
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
