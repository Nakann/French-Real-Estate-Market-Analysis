import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const min_lat = parseFloat(searchParams.get('min_lat') || '0');
  const max_lat = parseFloat(searchParams.get('max_lat') || '0');
  const min_lon = parseFloat(searchParams.get('min_lon') || '0');
  const max_lon = parseFloat(searchParams.get('max_lon') || '0');

  if (!min_lat || !max_lat || !min_lon || !max_lon) {
    return NextResponse.json({ error: 'Missing bounding box parameters' }, { status: 400 });
  }

  try {
    console.log(`Fetching communes for bounds: ${min_lon},${min_lat} to ${max_lon},${max_lat}`);
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
      [min_lon, min_lat, max_lon, max_lat]
    );

    // Formater en GeoJSON standard
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
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
