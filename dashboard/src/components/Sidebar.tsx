"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";

// ── Icons inline SVG (no dependency) ──────────────────────────────────────────
const IconMap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);
const IconFilter = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const IconHome = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IconTrend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconGini = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
  </svg>
);
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ── DPE config ─────────────────────────────────────────────────────────────────
const DPE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
  B: { color: "#22c55e", bg: "#f0fdf4", border: "#4ade80" },
  C: { color: "#84cc16", bg: "#f7fee7", border: "#a3e635" },
  D: { color: "#eab308", bg: "#fefce8", border: "#fde047" },
  E: { color: "#f97316", bg: "#fff7ed", border: "#fdba74" },
  F: { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5" },
  G: { color: "#991b1b", bg: "#fef2f2", border: "#f87171" },
};

// ── Props ───────────────────────────────────────────────────────────────────────
interface SidebarProps {
  realEstates: any[];
  filters: { dpe: string[]; commune: string; showFloodZones: boolean };
  onFiltersChange: (f: { dpe: string[]; commune: string; showFloodZones: boolean }) => void;
  onCommuneSelect: (lat: number, lon: number) => void;
  onOpenEstimator: () => void;
  onOpenComparator: () => void;
}

export function Sidebar({ realEstates, filters, onFiltersChange, onCommuneSelect, onOpenEstimator, onOpenComparator }: SidebarProps) {
  const [filteredCommunes, setFilteredCommunes] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filters.commune || filters.commune.trim() === "") {
      setFilteredCommunes([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/communes?query=${encodeURIComponent(filters.commune)}`, { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          if (data.communes) {
            setFilteredCommunes(data.communes);
          }
        })
        .catch(err => {
          if (err.name !== "AbortError") {
            console.error("Error searching communes in Sidebar:", err);
          }
        });
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filters.commune]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Stats computed on visible data ───────────────────────────────────────────
  const stats = useMemo(() => {
    const filtered = realEstates.filter(r =>
      (filters.dpe.length === 0 || filters.dpe.includes(r.etiquette_dpe)) &&
      (filters.commune === "" || (r.adresse_complete || "").toLowerCase().includes(filters.commune.toLowerCase()) || (r.code_commune || "").includes(filters.commune) || (r.nom_commune || "").toLowerCase().includes(filters.commune.toLowerCase()))
    );

    const nb = filtered.length;
    const avecPrix = filtered.filter(r => r.prix_m2 > 0);
    const prixMoy = avecPrix.length > 0
      ? Math.round(avecPrix.reduce((s, r) => s + Number(r.prix_m2), 0) / avecPrix.length)
      : null;

    const avecPauvrete = filtered.filter(r => r.taux_pauvrete != null);
    const pauvreteMoy = avecPauvrete.length > 0
      ? (avecPauvrete.reduce((s, r) => s + Number(r.taux_pauvrete), 0) / avecPauvrete.length).toFixed(1)
      : null;
    const avecNivVie = filtered.filter(r => r.niveau_vie_median != null && r.niveau_vie_median > 0);
    const nivVieMoy = avecNivVie.length > 0
      ? Math.round(avecNivVie.reduce((s, r) => s + Number(r.niveau_vie_median), 0) / avecNivVie.length)
      : null;

    // DPE distribution
    const dpeDist: Record<string, number> = {};
    filtered.forEach(r => {
      if (r.etiquette_dpe) dpeDist[r.etiquette_dpe] = (dpeDist[r.etiquette_dpe] || 0) + 1;
    });

    return { nb, prixMoy, pauvreteMoy, nivVieMoy, dpeDist };
  }, [realEstates, filters]);

  const toggleDpe = (letter: string) => {
    const current = filters.dpe;
    const next = current.includes(letter)
      ? current.filter(d => d !== letter)
      : [...current, letter];
    onFiltersChange({ ...filters, dpe: next });
  };

  return (
    <aside className="slide-in absolute left-0 top-0 h-full w-72 bg-white/95 backdrop-blur-sm z-50 flex flex-col border-r border-slate-200 shadow-xl">
      {/* ── Logo / Header ── */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow">
          <IconMap />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">ImmoExplorer</h1>
          <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Marché Immobilier</p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto sidebar-scroll px-4 py-4 space-y-5">

        {/* ── Section Filtres ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <IconFilter />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtres</span>
          </div>

          {/* Recherche commune */}
          <div className="mb-3">
            <label className="block text-xs text-slate-500 mb-1 font-medium">Commune / Code postal</label>
            <div className="relative" ref={dropdownRef}>
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch />
              </span>
              <input
                type="text"
                value={filters.commune}
                onChange={e => {
                  onFiltersChange({ ...filters, commune: e.target.value });
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ex: Nantes, 44000..."
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-300 text-slate-800"
              />
              {showDropdown && filteredCommunes.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-[1100]">
                  {filteredCommunes.map((commune) => (
                    <button
                      key={commune.code}
                      onClick={() => {
                        onFiltersChange({ ...filters, commune: commune.name });
                        setShowDropdown(false);
                        if (commune.latitude && commune.longitude) {
                          onCommuneSelect(commune.latitude, commune.longitude);
                        }
                      }}
                      className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 transition flex justify-between items-center cursor-pointer"
                    >
                      <span className="font-semibold">{commune.name}</span>
                      <span className="text-[10px] text-slate-400">{commune.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DPE toggle */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 font-medium">Étiquette DPE</label>
            <div className="flex gap-1">
              {Object.keys(DPE_CONFIG).map(letter => {
                const active = filters.dpe.includes(letter);
                const cfg = DPE_CONFIG[letter];
                return (
                  <button
                    key={letter}
                    onClick={() => toggleDpe(letter)}
                    className="flex-1 py-1.5 text-xs font-bold rounded-md border transition-all"
                    style={active
                      ? { background: cfg.bg, color: cfg.color, borderColor: cfg.border }
                      : { background: "#f8fafc", color: "#94a3b8", borderColor: "#e2e8f0" }
                    }
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            {filters.dpe.length > 0 && (
              <button
                onClick={() => onFiltersChange({ ...filters, dpe: [] })}
                className="mt-1.5 text-[10px] text-indigo-500 hover:text-indigo-700 font-medium transition"
              >
                Effacer la sélection
              </button>
            )}
          </div>

          {/* Zones inondables toggle */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <label className="block text-xs font-bold text-slate-700">Zones inondables</label>
              <p className="text-[10px] text-slate-400">Afficher les PPRI sur la carte</p>
            </div>
            <button
              onClick={() => onFiltersChange({ ...filters, showFloodZones: !filters.showFloodZones })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${filters.showFloodZones ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: filters.showFloodZones ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
          </div>
        </section>

        {/* ── Séparateur ── */}
        <div className="h-px bg-slate-100" />

        {/* ── KPIs Zone visible ── */}
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <IconGini />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone visible · {stats.nb} biens</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Transactions */}
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex flex-col items-center text-center">
              <span className="text-indigo-600 mb-1"><IconHome /></span>
              <span className="text-xl font-black text-indigo-700">{stats.nb > 0 ? stats.nb.toLocaleString("fr-FR") : "—"}</span>
              <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold mt-0.5">Transactions</span>
            </div>
            {/* Prix moyen */}
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex flex-col items-center text-center">
              <span className="text-emerald-600 mb-1"><IconTrend /></span>
              <span className="text-xl font-black text-emerald-700">{stats.prixMoy ? stats.prixMoy.toLocaleString("fr-FR") + "€" : "—"}</span>
              <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold mt-0.5">Moy / m²</span>
            </div>
          </div>

          {/* Socio-eco */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 divide-y divide-slate-100 overflow-hidden text-sm">
            <div className="px-3 py-2 flex justify-between items-center">
              <span className="text-slate-500 text-xs">Niveau de vie méd.</span>
              <span className="font-semibold text-slate-800 text-xs">{stats.nivVieMoy ? stats.nivVieMoy.toLocaleString("fr-FR") + " €" : "—"}</span>
            </div>
            <div className="px-3 py-2 flex justify-between items-center">
              <span className="text-slate-500 text-xs">Taux de pauvreté</span>
              <span className="font-semibold text-rose-600 text-xs">{stats.pauvreteMoy ? stats.pauvreteMoy + " %" : "—"}</span>
            </div>

          </div>
        </section>

        {/* ── Distribution DPE ── */}
        {Object.keys(stats.dpeDist).length > 0 && (
          <>
            <div className="h-px bg-slate-100" />
            <section>
              <div className="flex items-center gap-1.5 mb-3">
                <IconFilter />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Répartition DPE</span>
              </div>
              <div className="space-y-1.5">
                {Object.keys(DPE_CONFIG)
                  .filter(l => stats.dpeDist[l] > 0)
                  .map(letter => {
                    const count = stats.dpeDist[letter] || 0;
                    const pct = stats.nb > 0 ? Math.round((count / stats.nb) * 100) : 0;
                    const cfg = DPE_CONFIG[letter];
                    return (
                      <div key={letter} className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded text-[10px] font-black flex items-center justify-center shrink-0"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >{letter}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: cfg.color }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 w-7 text-right">{pct}%</span>
                      </div>
                    );
                  })}
              </div>
            </section>
          </>
        )}
      </div>

      {/* ── Boutons Simulateur & Comparateur ── */}
      <div className="px-4 pb-3 space-y-2">
        <button
          onClick={onOpenEstimator}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold shadow-md transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Simulateur de prix
        </button>
        <button
          onClick={onOpenComparator}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white text-sm font-semibold shadow-md transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20v-6M6 20V10M18 20V4" />
          </svg>
          Comparateur
        </button>
        <Link
          href="/stats"
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white text-sm font-semibold shadow-md transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          Statistiques
        </Link>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[10px] text-slate-400">© 2026 Nathan Avenel &amp; Adrien Pineau</p>
        <span className="text-[10px] text-indigo-400 font-medium">BI Project</span>
      </div>
    </aside>
  );
}
