import { ProjectForm } from "@/components/forms/ProjectForm";
import { Page, PageHeader } from "@/components/ui/Page";

export default function NewProjectPage() {
  return (
    <Page className="mx-auto max-w-5xl">
      <PageHeader eyebrow="New engagement" title="Create client project" description="Add the commercial terms and governing SOW first. The boundary map must receive professional approval before any request can be analyzed." />
      <ProjectForm />
    </Page>
  );
}
