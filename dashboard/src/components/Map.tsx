"use client";

import { MapContainer, TileLayer, ZoomControl, useMapEvents, CircleMarker, GeoJSON, Popup } from "react-leaflet";
import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RealEstate {
  id_mutation: string;
  date_mutation: string;
  valeur_fonciere: number;
  surface_reelle_bati: number;
  type_local: string;
  prix_m2: number;
  adresse_complete: string;
  code_commune: string;
  code_departement: string;
  longitude: number;
  latitude: number;
  etiquette_dpe: string | null;
  etiquette_ges: string | null;
  consommation_energie: number | null;
  niveau_vie_median: number | null;
  taux_pauvrete: number | null;
  indice_gini: number | null;
  polygon_geojson: string | null;
}

interface MapFilters {
  dpe: string[];
  commune: string;
}

// ── DPE helper ─────────────────────────────────────────────────────────────────
const DPE_COLORS: Record<string, string> = {
  A: "#16a34a", B: "#22c55e", C: "#84cc16", D: "#eab308",
  E: "#f97316", F: "#ef4444", G: "#991b1b",
};
const getDpeColor = (dpe: string | null) => DPE_COLORS[dpe ?? ""] ?? "#94a3b8";

// ── Format helpers ─────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, suffix = "") =>
  n != null ? Number(n).toLocaleString("fr-FR") + suffix : "—";

// ── Popup card ─────────────────────────────────────────────────────────────────
function PropertyPopup({ re }: { re: RealEstate }) {
  const color = getDpeColor(re.etiquette_dpe);
  const date = re.date_mutation
    ? new Date(re.date_mutation).toLocaleDateString("fr-FR", { year: "numeric", month: "short" })
    : null;

  return (
    <div className="font-sans text-slate-800 text-sm">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-900 text-sm leading-snug">{re.type_local || "Bien immobilier"}</p>
            <p className="text-xs text-slate-400 mt-0.5">{re.adresse_complete || re.code_commune}</p>
          </div>
          {re.etiquette_dpe && (
            <span
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white shadow"
              style={{ background: color }}
            >
              {re.etiquette_dpe}
            </span>
          )}
        </div>
        {date && <p className="text-[10px] text-slate-400 mt-1">{date}</p>}
      </div>

      {/* Price grid */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-slate-100">
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Prix total</p>
          <p className="font-bold text-slate-900 mt-0.5">{fmt(re.valeur_fonciere, " €")}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Surface</p>
          <p className="font-bold text-slate-900 mt-0.5">{fmt(re.surface_reelle_bati, " m²")}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Prix / m²</p>
          <p className="text-lg font-black mt-0.5" style={{ color: "#4f46e5" }}>
            {re.prix_m2 ? Math.round(re.prix_m2).toLocaleString("fr-FR") + " €/m²" : "—"}
          </p>
        </div>
      </div>

      {/* DPE */}
      {(re.etiquette_dpe || re.consommation_energie) && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-2">Performance énergétique</p>
          <div className="flex gap-3">
            {re.etiquette_dpe && (
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded text-[11px] font-black text-white flex items-center justify-center" style={{ background: color }}>
                  {re.etiquette_dpe}
                </span>
                <span className="text-xs text-slate-600">DPE</span>
              </div>
            )}
            {re.etiquette_ges && (
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-6 rounded text-[11px] font-black bg-slate-200 text-slate-700 flex items-center justify-center">
                  {re.etiquette_ges}
                </span>
                <span className="text-xs text-slate-600">GES</span>
              </div>
            )}
            {re.consommation_energie && (
              <span className="text-xs text-slate-500 ml-auto">{fmt(re.consommation_energie, " kWh/m²/an")}</span>
            )}
          </div>
        </div>
      )}

      {/* Filosofi */}
      {(re.niveau_vie_median || re.taux_pauvrete || re.indice_gini) && (
        <div className="px-4 py-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-2">Socio-éco · Commune</p>
          <div className="space-y-1.5">
            {re.niveau_vie_median && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Niveau de vie méd.</span>
                <span className="font-semibold text-slate-800">{fmt(re.niveau_vie_median, " €")}</span>
              </div>
            )}
            {re.taux_pauvrete && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Taux de pauvreté</span>
                <span className="font-semibold text-rose-600">{re.taux_pauvrete} %</span>
              </div>
            )}
            {re.indice_gini && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Indice Gini</span>
                <span className="font-semibold text-amber-600">{re.indice_gini}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MapInteractions : handles bounds + fetch ───────────────────────────────────
function MapInteractions({
  setRealEstates,
  setLoading,
  filters,
}: {
  setRealEstates: (d: RealEstate[]) => void;
  setLoading: (b: boolean) => void;
  filters: MapFilters;
}) {
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback((mapInstance: L.Map) => {
    const bounds = mapInstance.getBounds();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    const url = `/api/immobilier?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}&limit=500`;

    fetch(url, { signal: abortRef.current.signal })
      .then(res => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((data: RealEstate[]) => {
        if (Array.isArray(data)) setRealEstates(data);
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Fetch error:", err); })
      .finally(() => setLoading(false));
  }, [setRealEstates, setLoading]);

  const map = useMapEvents({
    moveend() { fetchData(map); },
  });

  useEffect(() => {
    const timeout = setTimeout(() => fetchData(map), 150);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

// ── Main Map component ─────────────────────────────────────────────────────────
export default function Map({
  onDataLoaded,
  filters,
}: {
  onDataLoaded?: (data: RealEstate[]) => void;
  filters: MapFilters;
}) {
  const [mounted, setMounted] = useState(false);
  const [allData, setAllData] = useState<RealEstate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleDataLoaded = useCallback((data: RealEstate[]) => {
    setAllData(data);
    onDataLoaded?.(data);
  }, [onDataLoaded]);

  // Client-side filtering
  const visibleData = allData.filter(re => {
    if (filters.dpe.length > 0 && !filters.dpe.includes(re.etiquette_dpe ?? "")) return false;
    if (filters.commune) {
      const q = filters.commune.toLowerCase();
      if (
        !re.adresse_complete?.toLowerCase().includes(q) &&
        !re.code_commune?.includes(filters.commune)
      ) return false;
    }
    return true;
  });

  if (!mounted) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
        Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* ── Loading toast ── */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-slate-700 fade-up">
          <svg className="spinner w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          Chargement des biens…
        </div>
      )}

      {/* ── Badge compteur ── */}
      {!loading && visibleData.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white border border-slate-200 shadow rounded-full px-3 py-1.5 text-xs text-slate-600 font-medium fade-up">
          <span className="font-bold text-indigo-600">{visibleData.length.toLocaleString("fr-FR")}</span> biens affichés
        </div>
      )}

      <MapContainer
        center={[47.2184, -1.5536]}
        zoom={14}
        className="w-full h-full z-0"
        zoomControl={false}

      >
        {/* CartoDB Positron: fond clair élégant */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />

        <MapInteractions
          setRealEstates={handleDataLoaded}
          setLoading={setLoading}
          filters={filters}
        />

        {/* ── Render polygons or circle markers ── */}
        {visibleData.map((re, index) => {
          if (!re.latitude || !re.longitude) return null;
          const color = getDpeColor(re.etiquette_dpe);
          const popup = <Popup><PropertyPopup re={re} /></Popup>;

          if (re.polygon_geojson) {
            let geometry: any;
            try { geometry = JSON.parse(re.polygon_geojson); } catch { geometry = null; }
            if (geometry) {
              return (
                <GeoJSON
                  key={re.id_mutation + "-poly-" + index}
                  data={geometry}
                  style={{
                    fillColor: color,
                    color: "white",
                    weight: 1.5,
                    fillOpacity: 0.65,
                  }}
                >
                  {popup}
                </GeoJSON>
              );
            }
          }

          // Fallback: cercle
          return (
            <CircleMarker
              key={re.id_mutation + "-dot-" + index}
              center={[re.latitude, re.longitude]}
              radius={6}
              pathOptions={{
                fillColor: color,
                color: "white",
                weight: 1.5,
                fillOpacity: 0.85,
              }}
            >
              {popup}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
