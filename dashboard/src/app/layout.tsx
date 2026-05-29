import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Explorer Immo | SAE 602",
  description: "Explorateur interactif des données DVF et DPE - France",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${outfit.variable} dark`}>
      <body className="font-sans antialiased bg-slate-950 text-slate-50 overflow-hidden h-screen w-screen flex">
        {children}
      </body>
    </html>
  );
}
