import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Enterprise Auth System - Secure Authentication for Modern Applications",
  description: "Complete authentication solution with OAuth, MFA, RBAC, and subscription management. Built for enterprise-grade security and scalability.",
  keywords: "authentication, OAuth, MFA, RBAC, enterprise security, user management",
  openGraph: {
    title: "Enterprise Auth System",
    description: "Secure authentication solution for modern applications",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
