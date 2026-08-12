import { ResetPasswordForm } from "@/components/forms/AuthForms";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;

  return (
    <section className="
      sl-panel mx-auto my-10 max-w-md p-6
      sm:my-16 sm:p-8
    ">
      <p className="sl-eyebrow">Account recovery</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set a new password</h1>
      <p className="mt-2 text-sm text-audit-muted">Reset links expire after 30 minutes and can be used once.</p>
      {!token ? <p className="
        mt-5 rounded-md border border-critical/25 bg-critical/5 p-3 text-sm
        text-critical
      ">This reset link is incomplete.</p> : null}
      <div className="mt-6"><ResetPasswordForm token={token} /></div>
    </section>
  );
}
