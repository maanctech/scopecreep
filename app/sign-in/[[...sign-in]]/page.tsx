import { SignIn } from "@clerk/nextjs";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { problem } = await searchParams;

  return (
    <div className="
      flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center gap-6
    ">
      {problem === "account-exists" ? (
        <p
          className="
            max-w-md rounded-md border border-audit-border bg-white p-4 text-sm
            text-ink shadow-audit
          "
          role="alert"
        >
          An account already exists for that email address and is not linked to
          the profile you signed in with. Ask your administrator to link them
          before signing in again.
        </p>
      ) : null}
      <SignIn />
    </div>
  );
}
