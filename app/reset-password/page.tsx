import { ResetPasswordForm } from "@/components/forms/AuthForms";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <section className="mx-auto max-w-md rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <p className="text-sm font-semibold uppercase text-audit-muted">Account recovery</p>
      <h1 className="mt-2 text-2xl font-semibold">Set a new password</h1>
      <p className="mt-2 text-sm text-audit-muted">Reset links expire after 30 minutes and can be used once.</p>
      {!token ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">This reset link is incomplete.</p> : null}
      <div className="mt-6"><ResetPasswordForm token={token} /></div>
    </section>
  );
}
