"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Dashboard() {
  const [realEstates, setRealEstates] = useState<any[]>([]);
  const [filters, setFilters] = useState<{ dpe: string[]; commune: string }>({
    dpe: [],
    commune: "",
  });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-100">
      <Sidebar realEstates={realEstates} filters={filters} onFiltersChange={setFilters} />
      <main className="absolute inset-0 w-full h-full">
        <Map onDataLoaded={setRealEstates} filters={filters} />
      </main>
    </div>
  );
}
