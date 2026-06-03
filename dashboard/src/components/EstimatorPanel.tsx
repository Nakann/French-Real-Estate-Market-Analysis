"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calculator, Home, Building2, ArrowRight, Loader2, Landmark, Percent } from "lucide-react";

interface EstimatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Commune {
  code: string;
  name: string;
}

interface EstimateResult {
  user_price_m2: number;
  average_price_m2: number;
  percentage_diff: number;
  status: string;
  label: string;
  transaction_count: number;
  estimation_level: string;
  level_name: string;
  commune_price_m2: number | null;
  socio: {
    niveau_vie_median: number | null;
    taux_pauvrete: number | null;
    indice_gini: number | null;
  } | null;
  dpe: {
    user_dpe: string;
    avg_conso: number | null;
  };
}

export default function EstimatorPanel({ isOpen, onClose }: EstimatorPanelProps) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [filteredCommunes, setFilteredCommunes] = useState<Commune[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommune, setSelectedCommune] = useState<Commune | null>(null);

  // Neighborhood & Street fields
  const [irisList, setIrisList] = useState<{ code_iris: string; nom_iris: string }[]>([]);
  const [selectedIris, setSelectedIris] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [selectedStreet, setSelectedStreet] = useState("");
  const [streetSuggestions, setStreetSuggestions] = useState<{ nom_voie: string; transaction_count: number }[]>([]);
  const [showStreetDropdown, setShowStreetDropdown] = useState(false);
  const streetDropdownRef = useRef<HTMLDivElement>(null);
  
  // Form fields
  const [surface, setSurface] = useState("");
  const [price, setPrice] = useState("");
  const [propertyType, setPropertyType] = useState<"Maison" | "Appartement">("Maison");
  const [dpe, setDpe] = useState<string>("D");
  
  // Submission & Results
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Dropdown list control
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all communes on mount for instant client-side filtering
  useEffect(() => {
    fetch("/api/communes")
      .then((res) => res.json())
      .then((data) => {
        if (data.communes) {
          setCommunes(data.communes);
        }
      })
      .catch((err) => console.error("Error loading communes:", err));
  }, []);

  // Filter communes as user types
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCommunes([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = communes
      .filter((c) => c.name.toLowerCase().includes(query) || c.code.includes(query))
      .slice(0, 10);
    setFilteredCommunes(filtered);
  }, [searchQuery, communes]);

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
    if (!selectedCommune) {
      setError("Veuillez sélectionner une commune.");
      return;
    }
    if (!surface || !price) {
      setError("Veuillez renseigner la surface et le prix.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code_commune: selectedCommune.code,
          surface: parseFloat(surface),
          valeur: parseFloat(price),
          type_local: propertyType,
          etiquette_dpe: dpe,
          code_iris: selectedIris || undefined,
          street: selectedStreet || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Une erreur s'est produite lors de l'estimation.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "excellent_deal":
        return "from-emerald-50 to-teal-50 border-emerald-300 text-emerald-700";
      case "good_deal":
        return "from-teal-50 to-blue-50 border-teal-300 text-teal-700";
      case "fair_price":
        return "from-slate-50 to-slate-100 border-slate-300 text-slate-600";
      case "too_expensive":
        return "from-amber-50 to-orange-50 border-amber-300 text-amber-700";
      case "overpriced":
        return "from-red-50 to-rose-50 border-red-300 text-rose-700";
      default:
        return "from-slate-50 to-slate-100 border-slate-300 text-slate-600";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-0 h-full w-96 bg-white/95 backdrop-blur-sm z-50 flex flex-col border-l border-slate-200 shadow-xl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow">
                <Calculator size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">Simulateur de prix</h2>
                <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Analyse immobilière</p>
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
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type de bien */}
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-medium">Type de bien</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPropertyType("Maison")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      propertyType === "Maison"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Home size={15} />
                    Maison
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertyType("Appartement")}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      propertyType === "Appartement"
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Building2 size={15} />
                    Appartement
                  </button>
                </div>
              </div>

              {/* Commune (Autocomplete) */}
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label className="block text-xs text-slate-500 font-medium">Commune ou code INSEE</label>
                <input
                  type="text"
                  placeholder="Rechercher une commune..."
                  value={selectedCommune ? selectedCommune.name : searchQuery}
                  onChange={(e) => {
                    setSelectedCommune(null);
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-300"
                />
                
                {showDropdown && filteredCommunes.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredCommunes.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setSelectedCommune(c);
                          setSearchQuery("");
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
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
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition font-semibold"
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
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition placeholder:text-slate-300"
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
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          {s.nom_voie} <span className="text-slate-400">({s.transaction_count} ventes)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Surface & Prix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Surface (m²)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 75"
                    value={surface}
                    onChange={(e) => setSurface(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-500 font-medium">Prix demandé (€)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 240000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition"
                  />
                </div>
              </div>

              {/* Classe DPE */}
              <div className="space-y-1.5">
                <label className="block text-xs text-slate-500 font-medium">Classe Énergétique (DPE)</label>
                <div className="flex gap-1">
                  {["A", "B", "C", "D", "E", "F", "G"].map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setDpe(letter)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded cursor-pointer transition-all border ${
                        dpe === letter
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Estimation en cours...
                  </>
                ) : (
                  <>
                    Évaluer l'affaire
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            {/* Results Output */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Diagnostic Card */}
                <div className={`p-5 rounded-2xl border bg-gradient-to-br ${getStatusColor(result.status)} shadow-sm`}>
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-60 mb-1">Rapport de transaction</div>
                  <h3 className="text-xl font-black mb-4">{result.label}</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs opacity-80">Ton prix/m² :</span>
                      <span className="text-base font-bold text-slate-900">{result.user_price_m2.toLocaleString()} €</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs opacity-80">Moyenne secteur :</span>
                      <span className="text-base font-bold text-slate-900">{result.average_price_m2.toLocaleString()} €</span>
                    </div>
                    
                    {result.estimation_level !== 'commune' && result.commune_price_m2 && (
                      <div className="flex justify-between items-baseline border-t border-slate-900/10 pt-1 mt-1 opacity-70">
                        <span className="text-[10px]">Moyenne globale ville :</span>
                        <span className="text-xs font-bold text-slate-700">{result.commune_price_m2.toLocaleString()} €</span>
                      </div>
                    )}
                    
                    {/* Progress bar */}
                    <div className="pt-2">
                      <div className="h-1.5 w-full bg-white/60 rounded-full relative overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(10, 100 - result.percentage_diff))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] opacity-60 mt-1 font-semibold">
                        <span>Bonne affaire</span>
                        <span className={`font-bold ${result.percentage_diff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {result.percentage_diff > 0 ? `+${result.percentage_diff}%` : `${result.percentage_diff}%`}
                        </span>
                        <span>Trop cher</span>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-[10px] opacity-50 mt-3 italic">
                    Calculé sur {result.transaction_count} ventes à l'échelle :{" "}
                    <strong>{result.level_name}</strong> ({result.estimation_level === 'street' ? 'Rue' : result.estimation_level === 'iris' ? 'Quartier' : 'Commune'}).
                  </p>
                </div>

                {/* Socio-economic INSEE (FILOSOFI) */}
                {result.socio && (
                  <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                      <Landmark size={14} />
                      Contexte INSEE de la commune
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase">Niveau de vie médian</span>
                        <span className="font-bold text-slate-800">
                          {result.socio.niveau_vie_median ? `${result.socio.niveau_vie_median.toLocaleString()} €/an` : "Non dispo"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase">Taux de pauvreté</span>
                        <span className="font-bold text-slate-800">
                          {result.socio.taux_pauvrete ? `${result.socio.taux_pauvrete} %` : "Non dispo"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Energy Rating */}
                <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 flex items-center gap-2">
                    <Percent size={14} />
                    Performance Énergétique
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Classe DPE du bien :</span>
                      <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{result.dpe.user_dpe}</span>
                    </div>
                    {result.dpe.avg_conso && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Consommation moyenne secteur :</span>
                        <span className="font-bold text-slate-800">{result.dpe.avg_conso} kWh/m²/an</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
