"use client";

import { FailureNotice } from "@/components/ui/FailureNotice";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <FailureNotice
      title="This page could not be loaded"
      body="Nothing you have entered was changed or lost. Try again, and if it keeps happening, send us the reference below."
      reference={error.digest}
      onRetry={reset}
    />
  );
}
