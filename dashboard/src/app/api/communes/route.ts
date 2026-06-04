import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Option 1 : Paramètres de Bounding Box fournis -> Retourne le GeoJSON géométrique
  const min_lat = searchParams.get('min_lat');
  const max_lat = searchParams.get('max_lat');
  const min_lon = searchParams.get('min_lon');
  const max_lon = searchParams.get('max_lon');

  if (min_lat && max_lat && min_lon && max_lon) {
    const lat1 = parseFloat(min_lat);
    const lat2 = parseFloat(max_lat);
    const lon1 = parseFloat(min_lon);
    const lon2 = parseFloat(max_lon);

    try {
      console.log(`Fetching communes for bounds: ${lon1},${lat1} to ${lon2},${lat2}`);
      const res = await pool.query(
        `
        SELECT 
          code_commune,
          nom_commune,
          prix_m2_median,
          nb_mutations,
          niveau_vie_median,
          taux_pauvrete,
          ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.001))::json AS geometry
        FROM gold.fact_communes
        WHERE ST_Intersects(geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
          AND prix_m2_median IS NOT NULL
        LIMIT 2000
        `,
        [lon1, lat1, lon2, lat2]
      );

      const geojson = {
        type: 'FeatureCollection',
        features: res.rows.map(row => ({
          type: 'Feature',
          geometry: row.geometry,
          properties: {
            code_commune: row.code_commune,
            nom_commune: row.nom_commune,
            prix_m2_median: row.prix_m2_median,
            nb_mutations: row.nb_mutations,
            niveau_vie_median: row.niveau_vie_median,
            taux_pauvrete: row.taux_pauvrete,
          }
        }))
      };

      return NextResponse.json(geojson);
    } catch (error) {
      console.error('Database error in GeoJSON query:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Option 2 : Aucun paramètre fourni -> Retourne la liste texte simple (avec support optionnel de recherche)
  const queryParam = searchParams.get('query') || searchParams.get('search');
  try {
    let result;
    if (queryParam) {
      const q = queryParam.trim();
      result = await pool.query(`
        SELECT 
          code_commune, 
          nom_commune,
          ST_Y(ST_Centroid(geometry)) AS latitude,
          ST_X(ST_Centroid(geometry)) AS longitude
        FROM gold.fact_communes 
        WHERE (nom_commune ILIKE $1 OR code_commune LIKE $2)
          AND nom_commune IS NOT NULL 
          AND nom_commune != ''
          AND code_commune IS NOT NULL
        ORDER BY
          CASE WHEN nom_commune ILIKE $3 THEN 0 ELSE 1 END,
          COALESCE(nb_mutations, 0) DESC
        LIMIT 50;
      `, [`%${q}%`, `${q}%`, `${q}%`]);
    } else {
      result = await pool.query(`
        SELECT 
          code_commune, 
          nom_commune,
          ST_Y(ST_Centroid(geometry)) AS latitude,
          ST_X(ST_Centroid(geometry)) AS longitude
        FROM gold.fact_communes 
        WHERE nom_commune IS NOT NULL 
          AND nom_commune != ''
          AND code_commune IS NOT NULL
        ORDER BY COALESCE(nb_mutations, 0) DESC
        LIMIT 500;
      `);
    }

    const communes = result.rows.map((row: any) => ({
      code: row.code_commune,
      name: row.nom_commune.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
    }));

    return NextResponse.json({ communes });
  } catch (error) {
    console.error('Error fetching communes list:', error);
    return NextResponse.json({ error: 'Failed to fetch communes list' }, { status: 500 });
  }
}
