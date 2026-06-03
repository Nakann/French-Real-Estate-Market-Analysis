import type { Metadata } from "next";
import StatsPage from "@/components/StatsPage";

export const metadata: Metadata = {
  title: "Statistiques | ImmoExplorer",
  description: "Analyse statistique du marché immobilier — DVF, DPE, socio-économique",
};

export default function Stats() {
  return <StatsPage />;
}
