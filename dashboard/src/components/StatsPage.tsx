"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────
interface StatsData {
  kpis: {
    nb_transactions: number;
    prix_median_m2: number;
    surface_moyenne: number;
    nb_avec_dpe: number;
    prix_moyen: number;
  };
  evolution: { periode: string; type_local: string; prix_median: number; nb: number }[];
  dpe: { dpe: string; nb: number; pct: number }[];
  histo: { tranche: string; ordre: number; type_local: string; nb: number }[];
  socio: { niveau_vie_median: number; taux_pauvrete: number; indice_gini: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DPE_COLORS: Record<string, string> = {
  A: "#16a34a", B: "#22c55e", C: "#84cc16", D: "#eab308",
  E: "#f97316", F: "#ef4444", G: "#991b1b",
};

const COMMUNES_CONNUES = [
  { label: "Nantes", code: "44109" },
  { label: "Rennes", code: "35238" },
  { label: "Brest", code: "29019" },
  { label: "Saint-Malo", code: "35288" },
  { label: "Lorient", code: "56121" },
  { label: "Quimper", code: "29232" },
  { label: "Vannes", code: "56260" },
  { label: "Saint-Brieuc", code: "22278" },
  { label: "Saint-Nazaire", code: "44184" },
  { label: "Angers", code: "49007" },
];

const fmt = (n: number | null | undefined, suffix = "") =>
  n != null ? Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + suffix : "—";
const fmtDec = (n: number | null | undefined, d = 1, suffix = "") =>
  n != null ? Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d }) + suffix : "—";

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name} : <strong>{fmt(p.value, " €/m²")}</strong>
        </p>
      ))}
    </div>
  );
};

const HistoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-slate-700 mb-1">{label} €/m²</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name} : <strong>{fmt(p.value)} ventes</strong>
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-2 bg-white shadow-sm hover:shadow-md transition-shadow`}
      style={{ borderColor: color + "30" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + "15", color }}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StatsPage() {
  const [commune, setCommune] = useState("");
  const [type, setType] = useState<"all" | "Maison" | "Appartement">("all");
  const [yearMin, setYearMin] = useState(2021);
  const [yearMax, setYearMax] = useState(2025);
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<typeof COMMUNES_CONNUES>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        commune,
        type,
        yearMin: String(yearMin),
        yearMax: String(yearMax),
      });
      const res = await fetch(`/api/stats?${params}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [commune, type, yearMin, yearMax]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Suggestions de villes
  const handleCommuneInput = (val: string) => {
    setCommune(val);
    if (val.length >= 2) {
      const filtered = COMMUNES_CONNUES.filter(c =>
        c.label.toLowerCase().startsWith(val.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Evolution: pivot maison / appart
  const evolutionPivot = (() => {
    if (!data) return [];
    const map: Record<string, any> = {};
    data.evolution.forEach(row => {
      if (!map[row.periode]) map[row.periode] = { periode: row.periode };
      map[row.periode][row.type_local] = Math.round(row.prix_median);
    });
    return Object.values(map);
  })();

  // Histogramme: pivot maison / appart
  const histoPivot = (() => {
    if (!data) return [];
    const map: Record<string, any> = {};
    data.histo.forEach(row => {
      if (!map[row.tranche]) map[row.tranche] = { tranche: row.tranche, ordre: row.ordre };
      map[row.tranche][row.type_local] = row.nb;
    });
    return Object.values(map).sort((a, b) => a.ordre - b.ordre);
  })();

  const nbAvecDpe = data?.kpis?.nb_avec_dpe ?? 0;
  const nbTotal = data?.kpis?.nb_transactions ?? 0;
  const pctDpe = nbTotal > 0 ? Math.round((nbAvecDpe / nbTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 overflow-auto">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-lg leading-tight">Statistiques</h1>
              <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">ImmoExplorer · Marché immobilier</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition px-3 py-2 rounded-lg hover:bg-indigo-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            Retour à la carte
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Filtres ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filtres
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Ville */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ville / Commune</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={commune}
                  onChange={e => handleCommuneInput(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => commune.length >= 2 && setShowSuggestions(suggestions.length > 0)}
                  placeholder="Ex: Nantes, Rennes…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-300 text-slate-800"
                />
                {commune && (
                  <button onClick={() => { setCommune(""); setShowSuggestions(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
              {/* Suggestions rapides */}
              {!commune && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COMMUNES_CONNUES.slice(0, 6).map(c => (
                    <button key={c.code} onClick={() => setCommune(c.label)}
                      className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold hover:bg-indigo-100 transition border border-indigo-100">
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map(s => (
                    <button key={s.code} onClick={() => { setCommune(s.label); setShowSuggestions(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 text-slate-700 font-medium transition">
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type de bien */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de bien</label>
              <div className="flex gap-2">
                {(["all", "Maison", "Appartement"] as const).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                      type === t
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}>
                    {t === "all" ? "Tous" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Période */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Période : <span className="text-indigo-600">{yearMin} → {yearMax}</span>
              </label>
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  {[2021, 2022, 2023, 2024, 2025].map(y => (
                    <button key={y} onClick={() => {
                      if (y <= yearMax) setYearMin(y);
                      if (y >= yearMin) setYearMax(y);
                    }}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        y >= yearMin && y <= yearMax
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                          : "bg-slate-50 text-slate-400 border-slate-200"
                      }`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── KPIs ── */}
        <section>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Indicateurs clés {commune ? `· ${commune}` : "· Toute la région"}
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-100 p-5 bg-white h-24 animate-pulse">
                  <div className="h-3 w-1/2 bg-slate-100 rounded mb-3"/>
                  <div className="h-7 w-2/3 bg-slate-100 rounded"/>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Transactions"
                value={fmt(data?.kpis?.nb_transactions)}
                color="#4f46e5"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
              />
              <KpiCard
                label="Prix médian / m²"
                value={fmt(data?.kpis?.prix_median_m2, " €")}
                color="#059669"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}
              />
              <KpiCard
                label="Surface moyenne"
                value={fmtDec(data?.kpis?.surface_moyenne, 0, " m²")}
                color="#d97706"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
              />
              <KpiCard
                label="Couverture DPE"
                value={`${pctDpe} %`}
                color="#7c3aed"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
              />
            </div>
          )}
        </section>

        {/* ── Charts row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Evolution prix */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-1">Évolution du prix au m²</h3>
            <p className="text-xs text-slate-400 mb-5">Médiane trimestrielle, Maison vs Appartement</p>
            {loading ? (
              <div className="h-56 bg-slate-50 rounded-xl animate-pulse"/>
            ) : evolutionPivot.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Pas de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolutionPivot} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="periode" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                    tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Maison" stroke="#4f46e5" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 5, fill: "#4f46e5" }} name="Maison" />
                  <Line type="monotone" dataKey="Appartement" stroke="#059669" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 5, fill: "#059669" }} name="Appartement" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* DPE */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-1">Répartition DPE</h3>
            <p className="text-xs text-slate-400 mb-5">% des biens par étiquette</p>
            {loading ? (
              <div className="h-56 bg-slate-50 rounded-xl animate-pulse"/>
            ) : !data?.dpe?.length ? (
              <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Pas de données DPE</div>
            ) : (
              <div className="space-y-2.5">
                {["A","B","C","D","E","F","G"].filter(l => data?.dpe?.find(d => d.dpe === l)).map(letter => {
                  const row = data?.dpe?.find(d => d.dpe === letter);
                  if (!row) return null;
                  return (
                    <div key={letter} className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md text-xs font-black flex items-center justify-center text-white shrink-0"
                        style={{ background: DPE_COLORS[letter] }}>
                        {letter}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${row.pct}%`, background: DPE_COLORS[letter] }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600 w-10 text-right">{row.pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Charts row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Histogramme */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-1">Distribution des prix au m²</h3>
            <p className="text-xs text-slate-400 mb-5">Nombre de ventes par tranche de prix</p>
            {loading ? (
              <div className="h-56 bg-slate-50 rounded-xl animate-pulse"/>
            ) : histoPivot.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Pas de données</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={histoPivot} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="tranche" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${Math.round(v/1000)}k` : String(v)} />
                  <Tooltip content={<HistoTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Maison" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Maison" />
                  <Bar dataKey="Appartement" fill="#059669" radius={[4, 4, 0, 0]} name="Appartement" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Socio-éco */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-1">Indicateurs socio-économiques</h3>
            <p className="text-xs text-slate-400 mb-5">Données FILOSOFI · Moyenne de la zone</p>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_,i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse"/>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Niveau de vie médian</p>
                  <p className="text-2xl font-black text-emerald-700">{fmt(data?.socio?.niveau_vie_median, " €")}</p>
                  <p className="text-[10px] text-emerald-500 mt-0.5">par unité de consommation / an</p>
                </div>
                <div className="rounded-xl bg-rose-50 border border-rose-100 p-4">
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider mb-1">Taux de pauvreté</p>
                  <p className="text-2xl font-black text-rose-700">{fmtDec(data?.socio?.taux_pauvrete, 1, " %")}</p>
                  <p className="text-[10px] text-rose-400 mt-0.5">seuil à 60% du revenu médian</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Indice de Gini</p>
                  <p className="text-2xl font-black text-amber-700">{fmtDec(data?.socio?.indice_gini, 3)}</p>
                  <p className="text-[10px] text-amber-500 mt-0.5">0 = égalité parfaite · 1 = inégalité totale</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-400 py-4">
          Sources : DVF (Etalab) · DPE (ADEME) · FILOSOFI (INSEE) · © 2026 ImmoExplorer
        </footer>
      </main>
    </div>
  );
}
