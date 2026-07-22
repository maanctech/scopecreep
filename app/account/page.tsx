import { ChangePasswordForm } from "@/components/forms/AuthForms";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await requirePagePermission("settings:read");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
        <p className="text-sm font-semibold uppercase text-audit-muted">Account</p>
        <h1 className="mt-2 text-2xl font-semibold">{context.displayName}</h1>
        <dl className="mt-5 space-y-3 text-sm">
          <div><dt className="text-audit-muted">Email</dt><dd className="font-medium">{context.email}</dd></div>
          <div><dt className="text-audit-muted">Organization</dt><dd className="font-medium">{context.organizationName}</dd></div>
          <div><dt className="text-audit-muted">Role</dt><dd className="font-medium">{context.role}</dd></div>
        </dl>
        <div className="mt-6"><LogoutButton /></div>
      </section>
      <section className="rounded-md border border-audit-border bg-white p-6 shadow-audit">
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-audit-muted">Changing your password signs out every other active session.</p>
        <div className="mt-5"><ChangePasswordForm /></div>
      </section>
    </div>
  );
}
