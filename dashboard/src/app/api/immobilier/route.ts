import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const min_lat = parseFloat(searchParams.get('min_lat') || '0');
  const max_lat = parseFloat(searchParams.get('max_lat') || '0');
  const min_lon = parseFloat(searchParams.get('min_lon') || '0');
  const max_lon = parseFloat(searchParams.get('max_lon') || '0');
  const limit = parseInt(searchParams.get('limit') || '500');

  if (!min_lat || !max_lat || !min_lon || !max_lon) {
    return NextResponse.json({ error: 'Missing bounding box parameters' }, { status: 400 });
  }

  try {
    console.log("Fetching properties from DB...");
    const dbT0 = Date.now();
    const res = await pool.query(
      `
      SELECT 
        id_mutation,
        date_mutation,
        valeur_fonciere,
        surface_reelle_bati,
        type_local,
        prix_m2,
        adresse_complete,
        code_commune,
        longitude,
        latitude,
        etiquette_dpe,
        etiquette_ges,
        consommation_energie,
        niveau_vie_median,
        taux_pauvrete,
        indice_gini,
        distance_ban
      FROM gold.fact_immobilier
      WHERE latitude BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4
      ORDER BY date_mutation DESC
      LIMIT $5
      `,
      [min_lat, max_lat, min_lon, max_lon, limit]
    );
    console.log(`DB fetch took ${Date.now() - dbT0}ms. Rows: ${res.rows.length}`);
    const properties = res.rows;

    // 2. Fetch Cadastre Parcels from IGN ApiCarto for the bounding box
    let parcels: any[] = [];
    const bboxArea = Math.abs((max_lat - min_lat) * (max_lon - min_lon));
    
    // Si la zone est trop grande (zoom lointain), l'API IGN plante ou met trop de temps.
    // On ne récupère les polygones que si on est suffisamment zoomé (approx zoom 14/15+).
    if (bboxArea < 0.01) {
      try {
        console.log(`Fetching from IGN ApiCarto... Area: ${bboxArea.toFixed(5)}`);
        const ignT0 = Date.now();
        const ignUrl = `https://apicarto.ign.fr/api/cadastre/parcelle?bbox=${min_lon},${min_lat},${max_lon},${max_lat}`;
        const ignRes = await fetch(ignUrl, { signal: AbortSignal.timeout(4000) });
        console.log(`IGN fetch took ${Date.now() - ignT0}ms. Status: ${ignRes.status}`);
        if (ignRes.ok) {
          const cadastreData = await ignRes.json();
          parcels = cadastreData.features || [];
          console.log(`IGN returned ${parcels.length} features.`);
        }
      } catch (err) {
        console.warn("Could not fetch cadastre from IGN:", err);
      }
    } else {
      console.log(`Skipping IGN fetch, bounding box too large: ${bboxArea.toFixed(5)}`);
    }

    console.log("Starting Spatial Join...");
    const t0 = Date.now();

    // 3. Fast Spatial Join (BBox Pre-filtering + Turf precise check)
    // First, compute the bounding box for all parcels (O(P))
    const parcelsWithBbox = parcels.map((p: any) => {
      if (!p || !p.geometry || (p.geometry.type !== 'Polygon' && p.geometry.type !== 'MultiPolygon')) {
        return { ...p, isValid: false };
      }
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const processCoord = (c: number[]) => {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      };

      if (p.geometry.type === 'Polygon') {
        p.geometry.coordinates.forEach((ring: any) => ring.forEach(processCoord));
      } else if (p.geometry.type === 'MultiPolygon') {
        p.geometry.coordinates.forEach((poly: any) => poly.forEach((ring: any) => ring.forEach(processCoord)));
      }
      return { ...p, isValid: true, minX, minY, maxX, maxY };
    }).filter(p => p.isValid);

    // Then, for each point, filter by BBox (ultra-fast) before Turf geometry check (slow)
    const enrichedProperties = properties.map(row => {
      if (row.longitude && row.latitude && parcelsWithBbox.length > 0) {
        const pt = point([row.longitude, row.latitude]);
        
        const match = parcelsWithBbox.find(p => {
          // Fast BBox check
          if (row.longitude < p.minX || row.longitude > p.maxX || row.latitude < p.minY || row.latitude > p.maxY) {
            return false;
          }
          // Precise Geometry check
          try {
            return booleanPointInPolygon(pt, p as any);
          } catch (e) {
            return false;
          }
        });

        if (match) {
          row.polygon_geojson = JSON.stringify(match.geometry);
        }
      }
      return row;
    });

    console.log(`Spatial Join took ${Date.now() - t0}ms`);
    return NextResponse.json(enrichedProperties);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
