import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ImmoExplorer | SAE 602",
  description: "Explorateur interactif des données DVF et DPE - France",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="font-sans antialiased bg-slate-50 text-slate-800 overflow-hidden h-screen w-screen flex">
        {children}
      </body>
    </html>
  );
}
