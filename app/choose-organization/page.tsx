import { OrganizationList } from "@clerk/nextjs";

export default function ChooseOrganizationPage() {
  return (
    <div className="flex min-h-[calc(100vh-14rem)] items-center justify-center">
      <OrganizationList
        hidePersonal
        afterCreateOrganizationUrl="/app"
        afterSelectOrganizationUrl="/app"
      />
    </div>
  );
}
