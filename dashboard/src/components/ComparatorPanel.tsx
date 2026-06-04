"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Home, Building2, Loader2, Copy, BarChart4, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";

interface ComparatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Commune {
  code: string;
  name: string;
}

interface CompareResult {
  data: {
    exact: { nb_biens: number; avg_prix_m2: number | null; avg_prix_total: number | null; };
    variations: { minus_one_room: number | null; plus_one_room: number | null; with_terrain: number | null; without_terrain: number | null; };
  };
  resolved_level: string;
  level_name: string;
  ai_prompt: string;
}

export default function ComparatorPanel({ isOpen, onClose }: ComparatorPanelProps) {
  const [filteredCommunes, setFilteredCommunes] = useState<Commune[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommune, setSelectedCommune] = useState<Commune | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Neighborhood & Street fields
  const [irisList, setIrisList] = useState<{ code_iris: string; nom_iris: string }[]>([]);
  const [selectedIris, setSelectedIris] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [selectedStreet, setSelectedStreet] = useState("");
  const [streetSuggestions, setStreetSuggestions] = useState<{ nom_voie: string; transaction_count: number }[]>([]);
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const streetDropdownRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [propertyType, setPropertyType] = useState<"Maison" | "Appartement">("Maison");
  const [surface, setSurface] = useState("");
  const [pieces, setPieces] = useState("4");
  const [hasTerrain, setHasTerrain] = useState(false);
  const [hasDependance, setHasDependance] = useState(false);
  
  // States
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Server-side commune search with debounce (évite de charger 35k communes)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery === selectedCommune?.name) {
      setFilteredCommunes([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/communes?query=${encodeURIComponent(searchQuery)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (data.communes) setFilteredCommunes(data.communes.slice(0, 10));
        })
        .catch((err) => {
          if (err.name !== 'AbortError') console.error("Error searching communes:", err);
        });
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [searchQuery, selectedCommune]);

  // Load IRIS list when commune changes
  useEffect(() => {
    if (!selectedCommune) {
      setIrisList([]);
      setSelectedIris("");
      setStreetQuery("");
      setSelectedStreet("");
      setStreetSuggestions([]);
      return;
    }
    fetch(`/api/stats/iris?commune=${selectedCommune.code}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIrisList(data);
        } else {
          setIrisList([]);
        }
        setSelectedIris("");
        setStreetQuery("");
        setSelectedStreet("");
        setStreetSuggestions([]);
      })
      .catch((err) => {
        console.error("Error loading IRIS:", err);
        setIrisList([]);
      });
  }, [selectedCommune]);

  // Load street autocomplete suggestions
  useEffect(() => {
    if (!selectedCommune) {
      setStreetSuggestions([]);
      return;
    }
    if (streetQuery.trim().length < 2 || streetQuery === selectedStreet) {
      setStreetSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(() => {
      const params = new URLSearchParams({
        commune: selectedCommune.code,
        iris: selectedIris,
        q: streetQuery,
      });
      fetch(`/api/stats/streets?${params}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setStreetSuggestions(data);
          }
        })
        .catch((err) => console.error("Error loading streets:", err));
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [streetQuery, selectedCommune, selectedIris, selectedStreet]);

  // Handle clicks outside of dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (streetDropdownRef.current && !streetDropdownRef.current.contains(event.target as Node)) {
        setShowStreetDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommune) return setError("Veuillez sélectionner une commune.");
    if (!surface || !pieces) return setError("Veuillez renseigner la surface et les pièces.");

    setLoading(true); setError(null); setResult(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_commune: selectedCommune.code,
          type_local: propertyType,
          surface,
          pieces,
          has_terrain: hasTerrain,
          has_dependance: hasDependance,
          code_iris: selectedIris || undefined,
          street: selectedStreet || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Une erreur s'est produite lors de la comparaison.");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!result?.ai_prompt) return;
    navigator.clipboard.writeText(result.ai_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-0 h-full w-[450px] bg-white/95 backdrop-blur-sm z-50 flex flex-col border-l border-slate-200 shadow-xl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow">
                <BarChart4 size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">Comparateur IA</h2>
                <p className="text-[10px] text-teal-500 font-semibold uppercase tracking-wider">Benchmark & Insights</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 sidebar-scroll">
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type de bien */}
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-medium">Type de bien</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPropertyType("Maison")} className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${propertyType === "Maison" ? "bg-teal-600 border-teal-600 text-white shadow" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <Home size={15} /> Maison
                  </button>
                  <button type="button" onClick={() => setPropertyType("Appartement")} className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${propertyType === "Appartement" ? "bg-teal-600 border-teal-600 text-white shadow" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    <Building2 size={15} /> Appartement
                  </button>
                </div>
              </div>

              {/* Commune (Autocomplete) */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label className="block text-xs text-slate-500 font-medium">Commune</label>
                <input
                  type="text" placeholder="Rechercher une commune..."
                  value={selectedCommune ? selectedCommune.name : searchQuery}
                  onChange={(e) => { setSelectedCommune(null); setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition"
                />
                {showDropdown && filteredCommunes.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredCommunes.map((c) => (
                      <button
                        key={c.code} type="button"
                        onClick={() => { setSelectedCommune(c); setSearchQuery(""); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-2 hover:bg-teal-50 text-xs font-semibold text-slate-700 cursor-pointer border-b border-slate-100"
                      >
                        {c.name} <span className="text-slate-400">({c.code.slice(0, 2)})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quartier / IRIS (Visible uniquement si une commune est sélectionnée et possède des IRIS) */}
              {selectedCommune && irisList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Quartier / IRIS (optionnel)</label>
                  <select
                    value={selectedIris}
                    onChange={(e) => {
                      setSelectedIris(e.target.value);
                      setStreetQuery("");
                      setSelectedStreet("");
                      setStreetSuggestions([]);
                    }}
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition font-semibold"
                  >
                    <option value="">Tous les quartiers</option>
                    {irisList.map((item) => (
                      <option key={item.code_iris} value={item.code_iris}>
                        {item.nom_iris.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rue (Autocomplete, visible uniquement si une commune est sélectionnée) */}
              {selectedCommune && (
                <div className="space-y-1.5 relative" ref={streetDropdownRef}>
                  <label className="block text-xs text-slate-500 font-medium">Rue (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Saisir ou rechercher une rue..."
                    value={selectedStreet ? selectedStreet : streetQuery}
                    onChange={(e) => {
                      setSelectedStreet("");
                      setStreetQuery(e.target.value);
                      setShowStreetDropdown(true);
                    }}
                    onFocus={() => setShowStreetDropdown(true)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition placeholder:text-slate-300"
                  />
                  
                  {showStreetDropdown && streetSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xl z-50 max-h-48 overflow-y-auto">
                      {streetSuggestions.map((s) => (
                        <button
                          key={s.nom_voie}
                          type="button"
                          onClick={() => {
                            setSelectedStreet(s.nom_voie);
                            setStreetQuery(s.nom_voie);
                            setShowStreetDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-teal-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          {s.nom_voie} <span className="text-slate-400">({s.transaction_count} ventes)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Surface & Pièces */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Surface (m²)</label>
                  <input type="number" min="1" placeholder="Ex: 80" value={surface} onChange={(e) => setSurface(e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Nombre de pièces</label>
                  <input type="number" min="1" placeholder="Ex: 4" value={pieces} onChange={(e) => setPieces(e.target.value)} className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 transition" />
                </div>
              </div>

              {/* Options secondaires */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
                  <input type="checkbox" checked={hasTerrain} onChange={(e) => setHasTerrain(e.target.checked)} className="text-teal-600 focus:ring-teal-500 rounded border-slate-300" />
                  <span className="text-xs font-medium text-slate-700">Terrain / Jardin</span>
                </label>
                <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition">
                  <input type="checkbox" checked={hasDependance} onChange={(e) => setHasDependance(e.target.checked)} className="text-teal-600 focus:ring-teal-500 rounded border-slate-300" />
                  <span className="text-xs font-medium text-slate-700">Dépendances</span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all mt-2 cursor-pointer">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Analyse en cours...</> : <><Search size={16} /> Rechercher des comparables</>}
              </button>
            </form>

            {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">{error}</div>}

            {/* Results Output */}
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                
                {/* Score Exact */}
                <div className="p-5 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 shadow-sm relative overflow-hidden">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-teal-600/80 mb-3">
                    Comparables à l'échelle : <strong>{result.level_name}</strong> ({result.resolved_level === 'street' ? 'Rue' : result.resolved_level === 'iris' ? 'Quartier' : 'Commune'})
                  </div>
                  
                  {result.data.exact.nb_biens > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-3xl font-black text-slate-900">{result.data.exact.avg_prix_total?.toLocaleString()} €</div>
                        <div className="text-xs font-bold text-teal-700 mt-1">{result.data.exact.avg_prix_m2?.toLocaleString()} € / m² en moyenne</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white/60 p-2 rounded-lg border border-teal-100/50">
                        <span className="w-5 h-5 bg-teal-100 text-teal-700 rounded flex items-center justify-center text-[10px] font-black">{result.data.exact.nb_biens}</span>
                        transactions similaires trouvées.
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-700">Pas assez de biens similaires vendus récemment pour établir une base fiable.</div>
                  )}
                </div>

                {/* Variations */}
                <div className="border border-slate-200 bg-slate-50 rounded-xl overflow-hidden divide-y divide-slate-100">
                  <div className="p-3 bg-slate-100/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                    L'impact des caractéristiques (Secteur : {result.level_name})
                  </div>
                  
                  {/* Pièces */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-2"><ArrowLeftRight size={14} className="text-slate-400"/> Même surface, 1 pièce de moins</span>
                      <span className="text-sm font-bold">{result.data.variations.minus_one_room ? result.data.variations.minus_one_room.toLocaleString() + " €" : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-2"><ArrowLeftRight size={14} className="text-slate-400"/> Même surface, 1 pièce de plus</span>
                      <span className="text-sm font-bold">{result.data.variations.plus_one_room ? result.data.variations.plus_one_room.toLocaleString() + " €" : "—"}</span>
                    </div>
                  </div>
                  
                  {/* Terrain */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-2"><TrendingDown size={14} className="text-slate-400"/> Biens sans terrain</span>
                      <span className="text-sm font-bold">{result.data.variations.without_terrain ? result.data.variations.without_terrain.toLocaleString() + " €" : "—"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-600 flex items-center gap-2"><TrendingUp size={14} className="text-teal-500"/> Biens avec terrain</span>
                      <span className="text-sm font-bold text-teal-700">{result.data.variations.with_terrain ? result.data.variations.with_terrain.toLocaleString() + " €" : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Prompt AI */}
                <div className="p-4 bg-slate-900 rounded-xl text-white shadow-lg space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400">Générer l'analyse IA</h4>
                    <button 
                      onClick={handleCopyPrompt}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                      title="Copier le prompt pour ChatGPT"
                    >
                      {copied ? <span className="text-xs font-bold text-teal-400">Copié !</span> : <Copy size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Copiez ce contexte enrichi avec les vraies données du marché et collez-le dans <strong>ChatGPT</strong> ou <strong>Claude</strong> pour obtenir une analyse rédigée et experte sur mesure.
                  </p>
                </div>

              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
