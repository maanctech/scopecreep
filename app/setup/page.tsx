import { redirect } from "next/navigation";
import { SetupForm } from "@/components/forms/AuthForms";
import { hasAnyUsers } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUsers()) redirect("/login");
  return (
    <section className="mx-auto max-w-lg rounded-md border border-audit-border bg-white p-6 shadow-audit">
      <p className="text-sm font-semibold uppercase text-audit-muted">First-run setup</p>
      <h1 className="mt-2 text-2xl font-semibold">Create the owner workspace</h1>
      <p className="mt-2 text-sm text-audit-muted">This one-time step creates the first organization and owner account. No client accounts or portals are created.</p>
      <div className="mt-6"><SetupForm /></div>
    </section>
  );
}
