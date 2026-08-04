import { ProjectForm } from "@/components/forms/ProjectForm";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="border-b border-audit-border pb-6">
        <h1 className="text-3xl font-semibold">Create client project</h1>
        <p className="mt-3 max-w-2xl text-sm/6 text-zinc-700">
          Paste the SOW text first. Message analysis runs from the project workspace.
        </p>
      </section>
      <ProjectForm />
    </div>
  );
}
