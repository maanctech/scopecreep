import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "ScopeLedger | Scope Creep Revenue Recovery",
  description:
    "Professional-controlled revenue audits that detect out-of-scope client requests before they become free work."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <body>
        <ClerkProvider nonce={nonce}>
          <Shell>{children}</Shell>
        </ClerkProvider>
      </body>
    </html>
  );
}
