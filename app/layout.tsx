import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { currentAuthContext } from "@/lib/auth/current";
import { unreadNotificationCountFor } from "@/lib/notifications/service";

export const metadata: Metadata = {
  title: "ScopeLedger | Find the work your agency never billed",
  description:
    "Compare client requests with approved SOWs, surface evidence-linked potential leakage, and keep every billing decision in professional hands."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const auth = await currentAuthContext();
  const unreadNotifications = auth
    ? await unreadNotificationCountFor(auth.organizationId, auth.userId).catch(() => 0)
    : 0;

  return (
    <html lang="en" data-scroll-behavior="smooth">
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
