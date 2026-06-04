"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import EstimatorPanel from "@/components/EstimatorPanel";
import ComparatorPanel from "@/components/ComparatorPanel";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Dashboard() {
  const [realEstates, setRealEstates] = useState<any[]>([]);
  const [filters, setFilters] = useState<{ dpe: string[]; commune: string; showFloodZones: boolean }>({
    dpe: [],
    commune: "",
    showFloodZones: false
  });
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number; zoom: number; timestamp: number } | null>(null);
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const [isComparatorOpen, setIsComparatorOpen] = useState(false);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100">
      <Sidebar
        realEstates={realEstates}
        filters={filters}
        onFiltersChange={setFilters}
        onCommuneSelect={(lat, lon) => {
          setFlyToTarget({ lat, lon, zoom: 14, timestamp: Date.now() });
        }}
        onOpenEstimator={() => { setIsComparatorOpen(false); setIsEstimatorOpen(true); }}
        onOpenComparator={() => { setIsEstimatorOpen(false); setIsComparatorOpen(true); }}
      />
      <main className="absolute inset-0 w-full h-full">
        <Map onDataLoaded={setRealEstates} filters={filters} flyToTarget={flyToTarget} />
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
