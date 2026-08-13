import { clerkClient } from "@clerk/nextjs/server";

export type DirectoryOrganization = {
  name: string;
  slug: string | null;
};

export type DirectoryUser = {
  email: string | null;
  fullName: string | null;
};

export type ClerkDirectory = {
  organization: (clerkOrganizationId: string) => Promise<DirectoryOrganization>;
  user: (clerkUserId: string) => Promise<DirectoryUser>;
};

export const liveClerkDirectory: ClerkDirectory = {
  async organization(clerkOrganizationId) {
    const clerk = await clerkClient();
    const organization = await clerk.organizations.getOrganization({ organizationId: clerkOrganizationId });

    return { name: organization.name, slug: organization.slug };
  },

  async user(clerkUserId) {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(clerkUserId);
    const primary = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId);

    return {
      email: primary?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null
    };
  }
};
