"use client";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-8" role="alert">
      <h1 className="text-xl font-semibold text-red-900">Something went wrong</h1>
      <p className="mt-2 max-w-2xl text-base/7 text-red-800">
        {error.message ||
          "The workspace could not be loaded. Your data was not changed by this error."}
      </p>
      <p className="mt-2 max-w-2xl text-sm/6 text-red-800">
        If this mentions a corrupt data file, your original file was backed up in the data folder
        and was not replaced. You can restore it manually or run <code>npm run seed</code> to start
        over with demo data.
      </p>
      <button
        type="button"
        onClick={reset}
        className="
          mt-4 inline-flex h-11 items-center rounded-md bg-ink px-5 text-sm
          font-semibold text-white
          hover:bg-zinc-800
        "
      >
        Try again
      </button>
    </div>
  );
}
