import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getSession } from "@/lib/auth/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tome Tracker",
  description: "Scan and manage your personal book library",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const user = session ? { email: session.email, role: session.role } : null;

  return (
    <html lang="en">
      <body className={inter.className}>
        <Header user={user} />
        <main className="min-h-screen pb-20 sm:pb-8">{children}</main>
        {user && <MobileNav />}
      </body>
    </html>
  );
}

