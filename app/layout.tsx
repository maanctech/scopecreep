import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { currentAuthContext } from "@/lib/auth/current";
import { unreadNotificationCountFor } from "@/lib/notifications/service";

export const metadata: Metadata = {
  title: "ScopeLedger | Scope Creep Revenue Recovery",
  description:
    "Professional-controlled revenue audits that detect out-of-scope client requests before they become free work."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await currentAuthContext();
  const unreadNotifications = auth
    ? await unreadNotificationCountFor(auth.organizationId, auth.userId).catch(() => 0)
    : 0;

  return (
    <html lang="en">
      <body>
        <Shell
          auth={auth ? { role: auth.role, isSystemAdmin: auth.isSystemAdmin } : null}
          unreadNotifications={unreadNotifications}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
