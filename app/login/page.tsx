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
    <section className="
      sl-panel mx-auto my-10 max-w-md p-6
      sm:my-16 sm:p-8
    ">
      <p className="sl-eyebrow">Secure workspace</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Professional sign in</h1>
      <p className="mt-2 text-sm/6 text-audit-muted">Access is restricted to authorized members of your internal revenue team.</p>
      <div className="mt-6"><LoginForm nextPath={next} /></div>
      <p className="mt-6 text-xs text-audit-muted">Forgot your password? A server administrator can generate a 30-minute reset link with the documented reset command.</p>
      <Link className="
        mt-4 inline-block text-sm font-semibold underline underline-offset-4
      " href="/">Return to website</Link>
    </section>
  );
}
