import Link from "next/link";
import { connection } from "next/server";

// Next prerenders the built-in not-found route at build time, which leaves its
// script tags without the per-request Content-Security-Policy nonce and blocks
// every one of them. Owning the route lets it render dynamically instead.
export default async function NotFound() {
  await connection();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-16">
      <p className="text-sm font-semibold text-audit-muted">404</p>
      <h1 className="text-3xl font-semibold">This page does not exist.</h1>
      <p className="text-sm/6 text-audit-body">
        Check the address, or return to the workspace and navigate from there.
      </p>
      <Link
        className="
          inline-block border border-audit-border px-4 py-2 text-sm
          font-semibold
          hover:bg-audit-soft
        "
        href="/app"
      >
        Back to the workspace
      </Link>
    </div>
  );
}
