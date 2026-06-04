import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim() || '';

  if (!id) {
    return NextResponse.json({ error: 'Missing property ID' }, { status: 400 });
  }

  try {
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
        distance_ban,
        in_zone_inondable,
        code_iris,
        nom_iris
      FROM gold.fact_immobilier
      WHERE id_mutation = $1
      LIMIT 1
      `,
      [id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const property = res.rows[0];
    let polygon_geojson = null;

    // Fetch the parcel geometry for this specific point coordinate from IGN ApiCarto
    if (property.longitude && property.latitude) {
      try {
        const geomParam = JSON.stringify({
          type: "Point",
          coordinates: [property.longitude, property.latitude]
        });
        const ignUrl = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${encodeURIComponent(geomParam)}`;
        const ignRes = await fetch(ignUrl, { signal: AbortSignal.timeout(4000) });
        
        if (ignRes.ok) {
          const cadastreData = await ignRes.json();
          const firstFeature = cadastreData.features?.[0];
          if (firstFeature && firstFeature.geometry) {
            polygon_geojson = JSON.stringify(firstFeature.geometry);
          }
        }
      } catch (ignErr) {
        console.warn(`Could not fetch parcel from IGN for coordinates [${property.longitude}, ${property.latitude}]:`, ignErr);
      }
    }

    return NextResponse.json({
      ...property,
      polygon_geojson
    });

  } catch (error) {
    console.error('Database Error in detail API:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
