"use client";

import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";

// La carte DOIT être importée dynamiquement car Leaflet nécessite l'objet 'window' du navigateur.
const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export default function Dashboard() {
  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <main className="absolute inset-0 w-full h-full pl-80">
        {/* On décale très légèrement la carte ou on laisse la sidebar flotter au dessus.
            Ici, la sidebar est Absolute Left, donc la carte est en arrière-plan. 
            On ne met pas le pl-80 sur la main pour garder l'effet immersif !
            Je supprime le pl-80 : */}
      </main>
      <main className="absolute inset-0 w-full h-full">
        <Map />
      </main>
    </div>
  );
}
