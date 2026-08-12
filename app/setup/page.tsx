import { redirect } from "next/navigation";
import { SetupForm } from "@/components/forms/AuthForms";
import { hasAnyUsers } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUsers()) redirect("/login");

  return (
    <section className="
      sl-panel mx-auto my-10 max-w-lg p-6
      sm:my-16 sm:p-8
    ">
      <p className="sl-eyebrow">First-run setup</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create the owner workspace</h1>
      <p className="mt-2 text-sm text-audit-muted">This one-time step creates the first organization and owner account. No client accounts or portals are created.</p>
      <div className="mt-6"><SetupForm /></div>
    </section>
  );
}
