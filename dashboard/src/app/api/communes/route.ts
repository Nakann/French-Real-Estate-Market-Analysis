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
          ST_AsGeoJSON(geometry)::json AS geometry
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
            nb_mutations: row.nb_mutations
          }
        }))
      };

      return NextResponse.json(geojson);
    } catch (error) {
      console.error('Database error in GeoJSON query:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // Option 2 : Aucun paramètre fourni -> Retourne la liste texte simple
  try {
    const result = await pool.query(`
      SELECT DISTINCT code_commune, nom_commune 
      FROM bronze.raw_dvf 
      WHERE nom_commune IS NOT NULL 
        AND nom_commune != ''
        AND code_commune IS NOT NULL
      ORDER BY nom_commune ASC;
    `);

    const communes = result.rows.map((row: any) => ({
      code: row.code_commune,
      name: row.nom_commune.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));

    return NextResponse.json({ communes });
  } catch (error) {
    console.error('Error fetching communes list:', error);
    return NextResponse.json({ error: 'Failed to fetch communes list' }, { status: 500 });
  }
}
