"use client";

import Link from "next/link";

type FailureNoticeProps = {
  title: string;
  body: string;
  reference?: string;
  onRetry?: () => void;
};

const ACTION_CLASS = `
  inline-flex h-11 items-center rounded-md px-5 text-sm font-semibold
  focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-red-900
`;

export function FailureNotice({ title, body, reference, onRetry }: FailureNoticeProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-8 text-red-900"
    >
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-2xl text-base/7">{body}</p>
      {reference ? (
        <p className="mt-4 text-sm/6">
          Quote this reference if you ask us to look into it:{" "}
          <span className="font-mono break-all">{reference}</span>
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className={`
              ${ACTION_CLASS}
              bg-red-900 text-white
              hover:bg-red-950
            `}
          >
            Try again
          </button>
        ) : null}
        <Link href="/app" className={`
          ${ACTION_CLASS}
          border border-red-300 bg-white
          hover:bg-red-100
        `}>
          Back to the workspace
        </Link>
      </div>
    </div>
  );
}
