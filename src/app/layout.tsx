import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Mentor PEBC",
  description: "Plateforme locale d’apprentissage fondée sur vos documents",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
