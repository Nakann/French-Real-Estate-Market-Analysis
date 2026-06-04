import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const min_lat = parseFloat(searchParams.get('min_lat') || '0');
  const max_lat = parseFloat(searchParams.get('max_lat') || '0');
  const min_lon = parseFloat(searchParams.get('min_lon') || '0');
  const max_lon = parseFloat(searchParams.get('max_lon') || '0');
  const limit = parseInt(searchParams.get('limit') || '50000');

  if (!min_lat || !max_lat || !min_lon || !max_lon) {
    return NextResponse.json({ error: 'Missing bounding box parameters' }, { status: 400 });
  }

  try {
    console.log("Fetching properties from DB...");
    const dbT0 = Date.now();
    const res = await pool.query(
      `
      SELECT
        f.id_mutation,
        f.longitude,
        f.latitude,
        f.date_mutation,
        f.valeur_fonciere,
        f.surface_reelle_bati,
        f.prix_m2,
        f.nombre_pieces_principales,
        f.type_local,
        f.adresse_complete,
        f.code_commune,
        f.code_iris,
        f.nom_iris,
        f.etiquette_dpe,
        f.etiquette_ges,
        f.consommation_energie,
        f.distance_ban,
        f.in_zone_inondable,
        c.nom_commune,
        c.niveau_vie_median,
        c.taux_pauvrete
      FROM gold.fact_immobilier f
      LEFT JOIN gold.fact_communes c ON f.code_commune = c.code_commune
      WHERE f.latitude BETWEEN $1 AND $2
        AND f.longitude BETWEEN $3 AND $4
      ORDER BY f.date_mutation DESC
      LIMIT $5
      `,
      [min_lat, max_lat, min_lon, max_lon, limit]
    );
    console.log(`DB fetch took ${Date.now() - dbT0}ms. Rows: ${res.rows.length}`);
    return NextResponse.json(res.rows);
  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
