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

  try {
    let query = `
      SELECT 
        id_ppri, 
        nom_zone, 
        niveau_risque, 
        ST_AsGeoJSON(geom)::jsonb as geometry
      FROM gold.stg_zones_inondables
    `;
    let params: any[] = [];

    if (min_lat && max_lat && min_lon && max_lon) {
      query += ` WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params = [min_lon, min_lat, max_lon, max_lat];
    }

    const res = await pool.query(query, params);
    
    const features = res.rows.map(row => ({
      type: "Feature",
      properties: {
        id_ppri: row.id_ppri,
        nom_zone: row.nom_zone,
        niveau_risque: row.niveau_risque
      },
      geometry: row.geometry
    }));

    return NextResponse.json({
      type: "FeatureCollection",
      features
    });
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
