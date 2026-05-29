"use client";

import { motion } from "framer-motion";
import { Search, Map as MapIcon, SlidersHorizontal, Home, TrendingUp, BarChart3 } from "lucide-react";

export function Sidebar() {
  return (
    <motion.aside 
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth spring
      className="glass-panel w-80 h-full flex flex-col z-50 absolute left-0 top-0"
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-800/50">
        <div className="flex items-center gap-3 text-teal-400 mb-2">
          <MapIcon size={24} />
          <h1 className="text-xl font-bold tracking-tight text-slate-50">ImmoExplorer</h1>
        </div>
        <p className="text-xs text-slate-400 font-medium">SAE 602 - BI Immobilière</p>
      </div>

      {/* Filters Section */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            <SlidersHorizontal size={16} />
            Filtres
          </h2>
          
          <div className="space-y-4">
            {/* Recherche */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Rechercher une commune</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Ex: Nantes, 44000..." 
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-slate-200"
                />
              </div>
            </div>

            {/* DPE */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Étiquette DPE</label>
              <div className="flex gap-1">
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(dpe => (
                  <button key={dpe} className="flex-1 py-1 text-xs font-bold rounded bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer">
                    {dpe}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Section */}
        <div className="mt-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            <BarChart3 size={16} />
            Statistiques (Vue)
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="glass p-3 rounded-xl flex flex-col justify-center items-center text-center">
              <Home size={18} className="text-indigo-400 mb-1" />
              <span className="text-xl font-bold text-slate-50">14k</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Transactions</span>
            </div>
            <div className="glass p-3 rounded-xl flex flex-col justify-center items-center text-center">
              <TrendingUp size={18} className="text-teal-400 mb-1" />
              <span className="text-xl font-bold text-slate-50">3,450€</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wide">Prix moy / m²</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center border-t border-slate-800/50">
        <p className="text-[10px] text-slate-500">© 2026 Nathan Avenel & Adrien Pineau</p>
      </div>
    </motion.aside>
  );
}
