"use client";

import { MapContainer, TileLayer, ZoomControl, useMapEvents, GeoJSON, Popup, Marker, useMap } from "react-leaflet";
import "leaflet.markercluster";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";

// ── Icons ──────────────────────────────────────────────────────────────────────
const createCustomIcon = (type: string, color: string) => {
  const isHouse = type?.toLowerCase() === "maison";
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

const ICON_CACHE: Record<string, L.DivIcon> = {};
const getCustomIcon = (type: string, color: string) => {
  const isHouse = type?.toLowerCase() === "maison";
  const key = `${isHouse ? "house" : "apt"}-${color}`;
  if (!ICON_CACHE[key]) {
    ICON_CACHE[key] = createCustomIcon(type, color);
  }
  return ICON_CACHE[key];
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
  in_zone_inondable: boolean;
  code_iris?: string | null;
  nom_iris?: string | null;
  nom_commune?: string | null;
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
  showFloodZones: boolean;
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
    <div className="font-sans text-slate-800 w-full overflow-hidden">
      {/* ── Header with dynamic gradient ── */}
      <div className="px-4 py-3.5 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 mb-1 shadow-sm">
              {re.type_local || "Bien"}
            </span>
            <p className="font-black text-slate-800 text-sm leading-snug truncate" title={re.adresse_complete}>
              {re.adresse_complete || "Adresse inconnue"}
            </p>
            {re.nom_iris && (
              <p className="text-[10px] text-teal-600 font-bold mt-1 flex items-center gap-1">
                <span className="shrink-0 text-xs">📍</span> {re.nom_iris}
              </p>
            )}
          </div>
          {re.etiquette_dpe && (
            <div className="flex flex-col items-center">
              <span
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md transition-transform hover:scale-105"
                style={{ 
                  background: color,
                  boxShadow: `0 4px 10px ${color}33`
                }}
              >
                {re.etiquette_dpe}
              </span>
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">DPE</span>
            </div>
          )}
        </div>
        
        {/* Date, Location Safety and Flood Zones */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-200/50">
          {date && (
            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/40">
              📅 {date}
            </span>
          )}
          
          {re.distance_ban !== null ? (
            re.distance_ban <= 50 ? (
              <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50" title={`Écart de ${Math.round(re.distance_ban)}m par rapport à la BAN`}>
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                BAN valide
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50" title={`Écart de ${Math.round(re.distance_ban)}m par rapport à la BAN`}>
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                BAN +50m
              </span>
            )
          ) : (
            <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/40">
              Non vérifié
            </span>
          )}

          {re.in_zone_inondable && (
            <span className="inline-flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50" title="Ce bien est situé dans une zone inondable (PPRI)">
              <svg className="w-2.5 h-2.5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Inondable (PPRI)
            </span>
          )}
        </div>
      </div>

      {/* ── Key financial and dimension grid ── */}
      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3.5 border-b border-slate-100 bg-white">
        <div>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Prix d'achat</span>
          </div>
          <p className="font-extrabold text-slate-800 text-sm mt-0.5">{fmt(re.valeur_fonciere, " €")}</p>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Surface</span>
          </div>
          <p className="font-extrabold text-slate-800 text-sm mt-0.5">{fmt(re.surface_reelle_bati, " m²")}</p>
        </div>
        
        {/* Dynamic banner for Price / m2 */}
        <div className="col-span-2 bg-gradient-to-br from-indigo-50/60 to-purple-50/30 rounded-xl border border-indigo-100/50 p-2.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2" /></svg>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Prix au m²</span>
          </div>
          <p className="text-base font-black text-indigo-600">
            {re.prix_m2 ? Math.round(re.prix_m2).toLocaleString("fr-FR") + " €" : "—"}
          </p>
        </div>
      </div>

      {/* ── Diagnostics energy block ── */}
      {(re.etiquette_dpe || re.consommation_energie) && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-2">Performance & Diagnostics</p>
          <div className="flex items-center gap-3">
            {re.etiquette_dpe && (
              <div className="flex items-center gap-1.5">
                <span className="w-5.5 h-5.5 rounded-lg text-[10px] font-black text-white flex items-center justify-center shadow-sm" style={{ background: color }}>
                  {re.etiquette_dpe}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">DPE</span>
              </div>
            )}
            {re.etiquette_ges && (
              <div className="flex items-center gap-1.5">
                <span className="w-5.5 h-5.5 rounded-lg text-[10px] font-black bg-purple-600 text-white flex items-center justify-center shadow-sm">
                  {re.etiquette_ges}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">GES</span>
              </div>
            )}
            {re.consommation_energie && (
              <span className="text-[10px] font-bold text-slate-600 ml-auto bg-white px-2 py-1 rounded border border-slate-200/50">
                ⚡ {fmt(re.consommation_energie, " kWh/m²")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Socio-eco block ── */}
      {(re.niveau_vie_median || re.taux_pauvrete) && (
        <div className="px-4 py-3 bg-white">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-2">Contexte Socio-économique</p>
          <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/30 p-2 text-xs">
            {re.niveau_vie_median && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">🏦 Vie Médiane</span>
                <span className="font-bold text-slate-700">{fmt(re.niveau_vie_median, " €")}</span>
              </div>
            )}
            {re.taux_pauvrete && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1">📈 Taux Pauvreté</span>
                <span className="font-bold text-rose-600">{re.taux_pauvrete} %</span>
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
  setFloodZones,
  setLoading,
  setZoom,
  filters,
}: {
  setRealEstates: (d: RealEstate[]) => void;
  setCommunes: (d: CommuneGeoJSON | null) => void;
  setFloodZones: (d: any | null) => void;
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
    let floodUrl = "";

    if (zoomLevel < 12) {
      url = `/api/communes?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}`;
    } else {
      url = `/api/immobilier?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}&limit=500`;
      if (filters.showFloodZones) {
        floodUrl = `/api/zones-inondables?min_lat=${bounds.getSouth()}&max_lat=${bounds.getNorth()}&min_lon=${bounds.getWest()}&max_lon=${bounds.getEast()}`;
      }
    }

    const fetches = [fetch(url, { signal: abortRef.current.signal }).then(r => {
      if (!r.ok) throw new Error(`API ${r.status}`);
      return r.json();
    })];

    if (floodUrl) {
      fetches.push(fetch(floodUrl, { signal: abortRef.current.signal }).then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`);
        return r.json();
      }));
    }

    Promise.all(fetches)
      .then(([data, floodData]) => {
        if (zoomLevel < 12) {
          setCommunes(data as CommuneGeoJSON);
          setRealEstates([]);
          setFloodZones(null);
        } else {
          if (Array.isArray(data)) setRealEstates(data as RealEstate[]);
          setCommunes(null);
          if (floodData) {
            setFloodZones(floodData);
          } else {
            setFloodZones(null);
          }
        }
      })
      .catch(err => { if (err.name !== "AbortError") console.error("Fetch error:", err); })
      .finally(() => setLoading(false));
  }, [setRealEstates, setCommunes, setFloodZones, setLoading, setZoom, filters.showFloodZones]);

  const map = useMapEvents({
    moveend() { fetchData(map); },
    zoomend() { fetchData(map); },
  });

  useEffect(() => {
    const timeout = setTimeout(() => fetchData(map), 150);
    return () => clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.showFloodZones]);

  return null;
}

// ── Basemap choices ────────────────────────────────────────────────────────────
const BASEMAPS = {
  carto_light: {
    name: "Carto Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  osm: {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  google_streets: {
    name: "Google Plan",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps'
  },
  google_satellite: {
    name: "Google Satellite",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps'
  }
};

// ── Native Marker Cluster Group (optimized to bypass React reconciliation lag) ──
function NativeClusterGroup({ 
  data, 
  onMarkerClick 
}: { 
  data: RealEstate[]; 
  onMarkerClick: (re: RealEstate, latlng: L.LatLng) => void;
}) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);

  useEffect(() => {
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        return L.divIcon({
          html: `<div><span>${cluster.getChildCount()}</span></div>`,
          className: 'marker-cluster-custom',
          iconSize: L.point(40, 40, true),
        });
      }
    });
    map.addLayer(cluster);
    clusterGroupRef.current = cluster;

    return () => {
      if (cluster) {
        map.removeLayer(cluster);
      }
    };
  }, [map]);

  useEffect(() => {
    const cluster = clusterGroupRef.current;
    if (!cluster) return;

    cluster.clearLayers();

    const markers: L.Marker[] = [];
    data.forEach((re) => {
      if (re.latitude && re.longitude) {
        const marker = L.marker([re.latitude, re.longitude], {
          icon: getCustomIcon(re.type_local, getDpeColor(re.etiquette_dpe))
        });
        marker.on("click", (e: any) => {
          onMarkerClick(re, e.latlng);
        });
        markers.push(marker);
      }
    });

    cluster.addLayers(markers);
  }, [data, onMarkerClick]);

  return null;
}

// ── Controller to programmatically pan/zoom map based on search selection ─────
function MapController({ 
  flyToTarget 
}: { 
  flyToTarget?: { lat: number; lon: number; zoom: number; timestamp: number } | null 
}) {
  const map = useMap();
  useEffect(() => {
    if (flyToTarget) {
      map.setView([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom, { animate: true, duration: 1.2 });
    }
  }, [flyToTarget, map]);
  return null;
}

// ── Main Map component ─────────────────────────────────────────────────────────
export default function Map({
  onDataLoaded,
  filters,
  flyToTarget,
}: {
  onDataLoaded?: (data: RealEstate[]) => void;
  filters: MapFilters;
  flyToTarget?: { lat: number; lon: number; zoom: number; timestamp: number } | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [allData, setAllData] = useState<RealEstate[]>([]);
  const [currentBasemap, setCurrentBasemap] = useState<keyof typeof BASEMAPS>("carto_light");
  const [communesData, setCommunesData] = useState<CommuneGeoJSON | null>(null);
  const [floodZones, setFloodZones] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(14);
  const [activeParcel, setActiveParcel] = useState<any | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<{
    re: RealEstate;
    latlng: L.LatLng;
  } | null>(null);
  const [debouncedCommune, setDebouncedCommune] = useState(filters.commune);
  const communesVersionRef = useRef(0);
  const floodVersionRef = useRef(0);
  const [communesKey, setCommunesKey] = useState('communes-0');
  const [floodKey, setFloodKey] = useState('floodzones-0');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCommune(filters.commune);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters.commune]);

  useEffect(() => { setMounted(true); }, []);

  const handleDataLoaded = useCallback((data: RealEstate[]) => {
    setAllData(data);
    onDataLoaded?.(data);
  }, [onDataLoaded]);

  const handleCommunesLoaded = useCallback((data: CommuneGeoJSON | null) => {
    setCommunesData(data);
    communesVersionRef.current += 1;
    setCommunesKey(`communes-${communesVersionRef.current}`);
  }, []);

  const handleFloodLoaded = useCallback((data: any) => {
    setFloodZones(data);
    floodVersionRef.current += 1;
    setFloodKey(`floodzones-${floodVersionRef.current}`);
  }, []);

  const handleMarkerClick = useCallback((re: RealEstate, latlng: L.LatLng) => {
    setSelectedProperty({ re, latlng });
    
    if (re.polygon_geojson) {
      try {
        setActiveParcel(JSON.parse(re.polygon_geojson));
        setSelectedId(re.id_mutation);
      } catch {
        setActiveParcel(null);
      }
    }
  }, []);

  const getCommuneColor = (prix: number) => {
    if (!prix) return "#e2e8f0";
    if (prix > 5000) return "#9f1239";
    if (prix > 4000) return "#be123c";
    if (prix > 3000) return "#fb7185";
    if (prix > 2000) return "#fcd34d";
    return "#86efac";
  };

  // Client-side filtering — filtre par DPE et par commune (code INSEE)
  const visibleData = allData.filter(re => {
    if (filters.dpe.length > 0 && !filters.dpe.includes(re.etiquette_dpe ?? "")) return false;
    if (debouncedCommune) {
      // Priorité : match exact sur code_commune, puis nom_commune
      const q = debouncedCommune.trim().toLowerCase();
      const matchCode = re.code_commune === debouncedCommune;
      const matchNom = re.nom_commune?.toLowerCase().includes(q);
      if (!matchCode && !matchNom) return false;
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
        preferCanvas={true}
        center={[47.2184, -1.5536]}
        zoom={14}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapController flyToTarget={flyToTarget} />
        {/* Dynamic Basemap Layer */}
        <TileLayer
          key={currentBasemap}
          attribution={BASEMAPS[currentBasemap].attribution}
          url={BASEMAPS[currentBasemap].url}
          maxZoom={19}
        />
        <ZoomControl position="bottomright" />

        <MapInteractions
          setRealEstates={handleDataLoaded}
          setCommunes={handleCommunesLoaded}
          setFloodZones={handleFloodLoaded}
          setLoading={setLoading}
          setZoom={setZoom}
          filters={filters}
        />

        {/* ── Active selected property parcel polygon ── */}
        {activeParcel && selectedId && (
          <GeoJSON
            key={"active-parcel-" + selectedId}
            data={activeParcel}
            style={{
              fillColor: "#4f46e5",
              color: "#4f46e5",
              weight: 2.5,
              fillOpacity: 0.2,
            }}
          />
        )}

        {/* ── Render Communes if zoom < 12 ── */}
        {zoom < 12 && communesData && (
          <GeoJSON
            key={communesKey}
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

        {/* ── Render Flood Zones if enabled ── */}
        {filters.showFloodZones && floodZones && (
          <GeoJSON
            key={floodKey}
            data={floodZones}
            style={(feature) => {
              const props = feature?.properties || {};
              const rawData = JSON.stringify(props).toLowerCase();
              let fillColor = '#3b82f6';
              let color = '#1d4ed8';
              
              if (rawData.includes('rouge') || rawData.includes('fort') || rawData.includes('élevé')) {
                fillColor = '#ef4444';
                color = '#b91c1c';
              } else if (rawData.includes('orange') || rawData.includes('moyen')) {
                fillColor = '#f97316';
                color = '#c2410c';
              } else if (rawData.includes('bleu') || rawData.includes('faible')) {
                fillColor = '#3b82f6';
                color = '#1d4ed8';
              }

              return {
                fillColor: fillColor,
                weight: 2,
                opacity: 0.9,
                color: color,
                fillOpacity: 0.35,
                dashArray: '5 5'
              };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature.properties;
              const riskStr = JSON.stringify(props).toLowerCase();
              let niveauAffiche = props.niveau_risque || 'Non spécifié';
              if (!props.niveau_risque) {
                if (riskStr.includes('rouge') || riskStr.includes('fort')) niveauAffiche = 'Fort (Zone Rouge)';
                else if (riskStr.includes('orange') || riskStr.includes('moyen')) niveauAffiche = 'Moyen (Zone Orange)';
                else if (riskStr.includes('bleu') || riskStr.includes('faible')) niveauAffiche = 'Faible (Zone Bleue)';
              }

              layer.bindTooltip(
                `<div class="text-sm font-sans text-slate-800 p-1">
                  <div class="flex items-center gap-2 mb-1">
                    <svg class="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <strong class="text-blue-900">Zonage PPRI</strong>
                  </div>
                  Zone : <strong>${props.nom_zone || props.code_zone || 'Inconnue'}</strong><br/>
                  Risque : <span class="uppercase font-bold text-slate-700">${niveauAffiche}</span>
                </div>`,
                { sticky: true, className: "bg-white/90 backdrop-blur shadow-md rounded-md border-0" }
              );
            }}
          />
        )}

        {/* ── Render markers efficiently using NativeClusterGroup ── */}
        {zoom >= 12 && (
          <NativeClusterGroup
            data={visibleData}
            onMarkerClick={handleMarkerClick}
          />
        )}

        {/* ── Single Dynamic Popup for selected property ── */}
        {selectedProperty && (
          <Popup
            position={selectedProperty.latlng}
            eventHandlers={{
              remove: () => {
                setSelectedProperty(null);
                setActiveParcel(null);
                setSelectedId(null);
              }
            }}
          >
            <PropertyPopup re={selectedProperty.re} />
          </Popup>
        )}
      </MapContainer>

      {/* ── Basemap Selector widget ── */}
      <div className="absolute bottom-4 left-[304px] z-[1000] bg-white/90 backdrop-blur border border-slate-200 shadow-md rounded-xl p-1.5 flex gap-1 items-center">
        {(Object.keys(BASEMAPS) as Array<keyof typeof BASEMAPS>).map((key) => (
          <button
            key={key}
            onClick={() => setCurrentBasemap(key)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
              currentBasemap === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {BASEMAPS[key].name}
          </button>
        ))}
      </div>
    </div>
  );
}
