import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { currentAuthContext } from "@/lib/auth/current";

export const metadata: Metadata = {
  title: "ScopeLedger | Scope Creep Revenue Recovery",
  description:
    "Professional-controlled revenue audits that detect out-of-scope client requests before they become free work."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await currentAuthContext();

  return (
    <html lang="en">
      <body>
        <Shell auth={auth ? { role: auth.role, isSystemAdmin: auth.isSystemAdmin } : null}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
