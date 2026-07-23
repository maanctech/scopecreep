import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "ScopeLedger | Scope Creep Revenue Recovery",
  description:
    "Professional-controlled revenue audits that detect out-of-scope client requests before they become free work."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
