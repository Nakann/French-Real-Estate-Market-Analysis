"use client";

import { MapContainer, TileLayer, ZoomControl, useMapEvents, GeoJSON, Popup, Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";

// ── Icons ──────────────────────────────────────────────────────────────────────
const createCustomIcon = (type: string, color: string) => {
  const isHouse = type?.toLowerCase() === "maison";
  // Un SVG minimal en ligne. Pour les maisons : un toit (home), pour les apparts : un building.
  const svg = isHouse 
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>`;

  return L.divIcon({
    html: `<div style="background-color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.25); border: 2px solid ${color};">
             <div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">${svg}</div>
           </div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

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
  distance_ban: number | null;
}

interface CommuneGeoJSON {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: any;
    properties: {
      code_commune: string;
      nom_commune: string;
      prix_m2_median: number;
      nb_mutations: number;
    };
  }[];
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
        <div className="flex items-center justify-between mt-1">
          {date && <p className="text-[10px] text-slate-400">{date}</p>}
          
          {/* Badge de Fiabilité de la localisation */}
          {re.distance_ban !== null ? (
            re.distance_ban <= 50 ? (
              <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title={`Écart de ${Math.round(re.distance_ban)}m par rapport à la BAN`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Localisation sûre
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`Écart de ${Math.round(re.distance_ban)}m par rapport à la BAN`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Imprécis (&gt;50m)
              </span>
            )
          ) : (
             <span className="text-[9px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded border border-slate-200" title="Adresse introuvable dans la BAN">
               Non vérifié
             </span>
          )}
        </div>
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
  setCommunes,
  setLoading,
  setZoom,
  filters,
}: {
  setRealEstates: (d: RealEstate[]) => void;
  setCommunes: (d: CommuneGeoJSON | null) => void;
  setLoading: (b: boolean) => void;
  setZoom: (z: number) => void;
  filters: MapFilters;
}) {
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback((mapInstance: L.Map) => {
    const bounds = mapInstance.getBounds();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    const zoomLevel = mapInstance.getZoom();
    setZoom(zoomLevel);

    let url = "";
    if (zoomLevel < 12) {
      url = `/api/communes?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}`;
    } else {
      url = `/api/immobilier?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}&limit=500`;
    }

    fetch(url, { signal: abortRef.current.signal })
      .then(res => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (zoomLevel < 12) {
          setCommunes(data as CommuneGeoJSON);
          setRealEstates([]);
        } else {
          if (Array.isArray(data)) setRealEstates(data as RealEstate[]);
          setCommunes(null);
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Fetch error:", err); })
      .finally(() => setLoading(false));
  }, [setRealEstates, setCommunes, setLoading, setZoom]);

  const map = useMapEvents({
    moveend() { fetchData(map); },
    zoomend() { fetchData(map); },
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
  const [communesData, setCommunesData] = useState<CommuneGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(14);

  useEffect(() => { setMounted(true); }, []);

  const handleDataLoaded = useCallback((data: RealEstate[]) => {
    setAllData(data);
    onDataLoaded?.(data);
  }, [onDataLoaded]);

  const getCommuneColor = (prix: number) => {
    if (!prix) return "#e2e8f0"; // slate-200
    if (prix > 5000) return "#9f1239"; // rose-900
    if (prix > 4000) return "#be123c"; // rose-700
    if (prix > 3000) return "#fb7185"; // rose-400
    if (prix > 2000) return "#fcd34d"; // amber-300
    return "#86efac"; // green-300
  };

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

  // Render markers efficiently
  const markers = useMemo(() => {
    return visibleData.map((re, index) => {
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

      // Fallback: icône vectorielle
      return (
        <Marker
          key={re.id_mutation + "-marker-" + index}
          position={[re.latitude, re.longitude]}
          icon={createCustomIcon(re.type_local, color)}
        >
          {popup}
        </Marker>
      );
    });
  }, [visibleData]);

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
          setCommunes={setCommunesData}
          setLoading={setLoading}
          setZoom={setZoom}
          filters={filters}
        />

        {/* ── Render Communes if zoom < 12 ── */}
        {zoom < 12 && communesData && (
          <GeoJSON
            key={"communes-" + Date.now()}
            data={communesData as any}
            style={(feature) => ({
              fillColor: getCommuneColor(feature?.properties?.prix_m2_median),
              weight: 1,
              opacity: 1,
              color: 'white',
              fillOpacity: 0.7
            })}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              layer.bindTooltip(
                `<div class="text-sm font-sans">
                  <strong>${props.nom_commune}</strong><br/>
                  Prix médian: ${props.prix_m2_median ? Math.round(props.prix_m2_median) + ' €/m²' : 'N/A'}<br/>
                  Ventes: ${props.nb_mutations || 0}
                </div>`,
                { sticky: true }
              );
              layer.on('click', (e) => {
                 const map = e.target._map;
                 map.flyToBounds(e.target.getBounds(), { duration: 0.8 });
              });
            }}
          />
        )}

        {/* ── Render markers efficiently using useMemo ── */}
        {zoom >= 12 && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            showCoverageOnHover={false}
            iconCreateFunction={(cluster: any) => {
              return L.divIcon({
                html: `<div><span>${cluster.getChildCount()}</span></div>`,
                className: 'marker-cluster-custom',
                iconSize: L.point(40, 40, true),
              });
            }}
          >
            {markers}
          </MarkerClusterGroup>
        )}
      </MapContainer>
    </div>
  );
}
