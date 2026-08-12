"use client";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="
      mx-auto max-w-3xl border-y border-critical/25 bg-critical/5 p-6
      sm:p-8
    " role="alert">
      <h1 className="text-xl font-semibold text-critical">Something went wrong</h1>
      <p className="mt-2 max-w-2xl text-base/7 text-critical">
        {error.message ||
          "The workspace could not be loaded. Your data was not changed by this error."}
      </p>
      <p className="mt-2 max-w-2xl text-sm/6 text-critical">
        Try again once. If the problem continues, ask the installation administrator to review
        System diagnostics and server logs. Do not re-enter or regenerate client data until the
        storage connection is confirmed healthy.
      </p>
      <button
        type="button"
        onClick={reset}
        className="sl-button-danger mt-5 border-critical bg-critical text-white"
      >
        Try again
      </button>
    </div>
  );
}
