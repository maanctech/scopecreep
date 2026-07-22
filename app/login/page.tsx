import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/AuthForms";
import { currentAuthContext } from "@/lib/auth/current";
import { hasAnyUsers } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!(await hasAnyUsers())) redirect("/setup");
  if (await currentAuthContext()) redirect("/app");
  const { next } = await searchParams;
  return (
    <section className="mx-auto max-w-md rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <p className="text-sm font-semibold uppercase text-audit-muted">ScopeLedger</p>
      <h1 className="mt-2 text-2xl font-semibold">Professional sign in</h1>
      <p className="mt-2 text-sm text-audit-muted">Access is restricted to your internal revenue team.</p>
      <div className="mt-6"><LoginForm nextPath={next} /></div>
      <p className="mt-6 text-xs text-audit-muted">Forgot your password? A server administrator can generate a 30-minute reset link with the documented reset command.</p>
      <Link className="mt-4 inline-block text-sm font-semibold underline underline-offset-4" href="/">Return to website</Link>
    </section>
  );
}
