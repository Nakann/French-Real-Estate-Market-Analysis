"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import EstimatorPanel from "@/components/EstimatorPanel";
import ComparatorPanel from "@/components/ComparatorPanel";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Dashboard() {
  const [realEstates, setRealEstates] = useState<any[]>([]);
  const [filters, setFilters] = useState<{ dpe: string[]; commune: string }>({
    dpe: [],
    commune: "",
  });
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const [isComparatorOpen, setIsComparatorOpen] = useState(false);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100">
      <Sidebar
        realEstates={realEstates}
        filters={filters}
        onFiltersChange={setFilters}
        onOpenEstimator={() => { setIsComparatorOpen(false); setIsEstimatorOpen(true); }}
        onOpenComparator={() => { setIsEstimatorOpen(false); setIsComparatorOpen(true); }}
      />
      <main className="absolute inset-0 w-full h-full">
        <Map onDataLoaded={setRealEstates} filters={filters} />
      </main>
      <EstimatorPanel
        isOpen={isEstimatorOpen}
        onClose={() => setIsEstimatorOpen(false)}
      />
      <ComparatorPanel
        isOpen={isComparatorOpen}
        onClose={() => setIsComparatorOpen(false)}
      />
    </div>
  );
}
