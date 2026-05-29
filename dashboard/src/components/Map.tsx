"use client";

import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMapEvents } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";

// Icône personnalisée pour le bien immobilier (maison)
const homeIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #6366f1; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-size: 16px;">🏠</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Icône personnalisée pour les écoles
const schoolIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f59e0b; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🎓</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// Icône personnalisée pour les transports
const transportIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ec4899; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">🚌</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

interface POI {
  id: number;
  type: 'school' | 'transport';
  name: string;
  lat: number;
  lon: number;
}

// Composant invisible pour capturer les événements de la carte
function MapInteractions({ setPois, setSelectedPos, setLoading }: any) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setSelectedPos([lat, lng]);
      setLoading(true);
      setPois([]); // On nettoie les anciens POIs
      
      fetch(`/api/pois?lat=${lat}&lon=${lng}&radius=500`)
        .then(res => res.json())
        .then(data => {
          if (data.pois) setPois(data.pois);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    },
  });
  return null;
}

export default function Map() {
  const [mounted, setMounted] = useState(false);
  const [selectedPos, setSelectedPos] = useState<[number, number] | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500">Chargement de la carte spatiale...</div>;
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading Overlay visuel quand on fetch Overpass API */}
      {loading && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] glass px-5 py-3 rounded-full text-slate-100 text-sm font-medium animate-pulse flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
          Recherche des commodités (500m)...
        </div>
      )}

      <MapContainer 
        center={[47.2184, -1.5536]} // Centre sur Nantes par défaut
        zoom={14} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* On décale les boutons de zoom pour ne pas qu'ils soient sous la Sidebar */}
        <ZoomControl position="bottomright" />
        
        {/* Capture des clics */}
        <MapInteractions setPois={setPois} setSelectedPos={setSelectedPos} setLoading={setLoading} />

        {/* Marqueur du "Bien Immobilier" sélectionné (simulé par le clic) */}
        {selectedPos && (
          <Marker position={selectedPos} icon={homeIcon}>
            <Popup className="font-sans">
              <div className="text-slate-900 text-center">
                <h3 className="font-bold text-sm">Bien sélectionné</h3>
                <p className="text-xs text-slate-500 mt-1">{pois.length} commodités à moins de 500m</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Affichage dynamique des POIs depuis Overpass API */}
        {pois.map((poi) => (
          <Marker 
            key={poi.id} 
            position={[poi.lat, poi.lon]} 
            icon={poi.type === 'school' ? schoolIcon : transportIcon}
          >
            <Popup className="font-sans">
              <div className="text-slate-900">
                <h3 className="font-bold text-sm flex items-center gap-1">
                  {poi.type === 'school' ? '🎓 École' : '🚌 Transport'}
                </h3>
                <p className="text-xs mt-1 font-medium">{poi.name}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
