import { ChangePasswordForm } from "@/components/forms/AuthForms";
import { LogoutButton } from "@/components/forms/LogoutButton";
import { Page, PageHeader } from "@/components/ui/Page";
import { requirePagePermission } from "@/lib/auth/current";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await requirePagePermission("settings:read");

  return (
    <Page>
      <PageHeader eyebrow="Administration" title="Account and security" description="Review your workspace access and update your password. Password changes revoke every other active session." />
      <div className="
        grid gap-6
        lg:grid-cols-2
      ">
      <section className="sl-panel p-6">
        <p className="sl-eyebrow">Profile</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{context.displayName}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div><dt className="text-audit-muted">Email</dt><dd className="
            font-medium
          ">{context.email}</dd></div>
          <div><dt className="text-audit-muted">Organization</dt><dd className="
            font-medium
          ">{context.organizationName}</dd></div>
          <div><dt className="text-audit-muted">Role</dt><dd className="
            font-medium
          ">{context.role}</dd></div>
        </dl>
        <div className="mt-6"><LogoutButton /></div>
      </section>
      <section className="sl-panel p-6">
        <h2 className="text-xl font-semibold">Change password</h2>
        <p className="mt-2 text-sm text-audit-muted">Changing your password signs out every other active session.</p>
        <div className="mt-5"><ChangePasswordForm /></div>
      </section>
      </div>
    </Page>
  );
}
