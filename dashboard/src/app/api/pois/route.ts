import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const radius = searchParams.get('radius') || '500';

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat or lon parameters' }, { status: 400 });
  }

  // Requête Overpass QL pour récupérer les écoles et transports
  // [out:json] définit le format de sortie
  // out center; calcule le centre pour les "ways" (chemins/polygones) pour avoir un point (lat, lon) facile à placer
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"~"school|college|university|kindergarten"](around:${radius},${lat},${lon});
      way["amenity"~"school|college|university|kindergarten"](around:${radius},${lat},${lon});
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      node["public_transport"~"platform|station"](around:${radius},${lat},${lon});
      node["railway"~"station|subway_entrance"](around:${radius},${lat},${lon});
    );
    out center;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Nettoyage et formatage pour l'interface
    const pois = data.elements.map((el: any) => {
      const type = el.tags?.amenity ? 'school' : 'transport';
      const name = el.tags?.name || (type === 'school' ? 'Établissement scolaire' : 'Arrêt / Station');
      const elementLat = el.lat || el.center?.lat;
      const elementLon = el.lon || el.center?.lon;
      
      return {
        id: el.id,
        type,
        name,
        lat: elementLat,
        lon: elementLon
      };
    });

    return NextResponse.json({ pois });
  } catch (error) {
    console.error('Error fetching POIs from Overpass:', error);
    return NextResponse.json({ error: 'Failed to fetch POIs' }, { status: 500 });
  }
}
