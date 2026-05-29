import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code_commune, type_local, surface, pieces, has_terrain, has_dependance } = body;

    if (!code_commune || !surface || !pieces || !type_local) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    const s = parseFloat(surface);
    const p = parseInt(pieces, 10);
    const minS = s * 0.85;
    const maxS = s * 1.15;

    // 1. Biens identiques (même ville, même type, surface ±15%, même nombre de pièces)
    const exactQuery = `
      SELECT 
        COUNT(*) as nb_biens,
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC) / CAST(surface_reelle_bati AS NUMERIC)) as avg_prix_m2,
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC)) as avg_prix_total
      FROM bronze.raw_dvf
      WHERE code_commune = $1
        AND type_local = $2
        AND NULLIF(valeur_fonciere, '') IS NOT NULL
        AND NULLIF(surface_reelle_bati, '') IS NOT NULL
        AND CAST(surface_reelle_bati AS NUMERIC) BETWEEN $3 AND $4
        AND nombre_pieces_principales = $5
    `;

    // 2. Variation: 1 pièce de moins
    const minusOneRoomQuery = `
      SELECT 
        COUNT(*) as nb_biens,
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC)) as avg_prix_total
      FROM bronze.raw_dvf
      WHERE code_commune = $1 AND type_local = $2 
        AND NULLIF(valeur_fonciere, '') IS NOT NULL AND NULLIF(surface_reelle_bati, '') IS NOT NULL
        AND CAST(surface_reelle_bati AS NUMERIC) BETWEEN $3 AND $4
        AND nombre_pieces_principales = $5
    `;

    // 3. Variation: 1 pièce de plus
    const plusOneRoomQuery = `
      SELECT 
        COUNT(*) as nb_biens,
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC)) as avg_prix_total
      FROM bronze.raw_dvf
      WHERE code_commune = $1 AND type_local = $2 
        AND NULLIF(valeur_fonciere, '') IS NOT NULL AND NULLIF(surface_reelle_bati, '') IS NOT NULL
        AND CAST(surface_reelle_bati AS NUMERIC) BETWEEN $3 AND $4
        AND nombre_pieces_principales = $5
    `;

    // 4. Variation: Impact Terrain (Uniquement pour les maisons)
    const terrainQuery = `
      SELECT 
        CASE WHEN NULLIF(surface_terrain, '') IS NOT NULL AND CAST(surface_terrain AS NUMERIC) > 0 THEN 'avec_terrain' ELSE 'sans_terrain' END as a_terrain,
        COUNT(*) as nb_biens,
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC)) as avg_prix_total
      FROM bronze.raw_dvf
      WHERE code_commune = $1 AND type_local = $2 
        AND NULLIF(valeur_fonciere, '') IS NOT NULL AND NULLIF(surface_reelle_bati, '') IS NOT NULL
        AND CAST(surface_reelle_bati AS NUMERIC) BETWEEN $3 AND $4
      GROUP BY 1
    `;

    const [exactRes, minusOneRes, plusOneRes, terrainRes] = await Promise.all([
      pool.query(exactQuery, [code_commune, type_local, minS, maxS, p.toString()]),
      pool.query(minusOneRoomQuery, [code_commune, type_local, minS, maxS, (p > 1 ? p - 1 : 0).toString()]),
      pool.query(plusOneRoomQuery, [code_commune, type_local, minS, maxS, (p + 1).toString()]),
      pool.query(terrainQuery, [code_commune, type_local, minS, maxS])
    ]);

    const exact = exactRes.rows[0];
    const minusOne = minusOneRes.rows[0];
    const plusOne = plusOneRes.rows[0];
    
    let prixAvecTerrain = null;
    let prixSansTerrain = null;
    terrainRes.rows.forEach(r => {
      if (r.a_terrain === 'avec_terrain') prixAvecTerrain = r.avg_prix_total;
      if (r.a_terrain === 'sans_terrain') prixSansTerrain = r.avg_prix_total;
    });

    const data = {
      exact: {
        nb_biens: parseInt(exact.nb_biens),
        avg_prix_m2: exact.avg_prix_m2 ? Math.round(parseFloat(exact.avg_prix_m2)) : null,
        avg_prix_total: exact.avg_prix_total ? Math.round(parseFloat(exact.avg_prix_total)) : null,
      },
      variations: {
        minus_one_room: minusOne.avg_prix_total ? Math.round(parseFloat(minusOne.avg_prix_total)) : null,
        plus_one_room: plusOne.avg_prix_total ? Math.round(parseFloat(plusOne.avg_prix_total)) : null,
        with_terrain: prixAvecTerrain ? Math.round(parseFloat(prixAvecTerrain)) : null,
        without_terrain: prixSansTerrain ? Math.round(parseFloat(prixSansTerrain)) : null,
      }
    };

    // Génération du Prompt AI
    const prompt = `Agis comme un expert immobilier de renom. Je souhaite avoir ton analyse sur un bien situé dans la commune ${code_commune}.

**Caractéristiques du bien cible :**
- Type: ${type_local}
- Surface: ${surface} m²
- Nombre de pièces: ${pieces}
- Terrain/Jardin: ${has_terrain ? 'Oui' : 'Non'}
- Dépendances: ${has_dependance ? 'Oui' : 'Non'}

**Données réelles du marché local (issues des Demandes de Valeurs Foncières - DVF) :**
- Il y a eu ${data.exact.nb_biens} ventes récentes de biens très similaires (même surface à ± 15% et même nombre de pièces).
- Prix de vente moyen constaté : ${data.exact.avg_prix_total ? data.exact.avg_prix_total.toLocaleString('fr-FR') + ' €' : 'N/A'} (soit environ ${data.exact.avg_prix_m2} €/m²).

**Variations et impact sur le marché local :**
- Si le bien avait 1 pièce de moins (pour la même surface), le prix moyen serait de : ${data.variations.minus_one_room ? data.variations.minus_one_room.toLocaleString('fr-FR') + ' €' : 'Pas de données suffisantes'}.
- Si le bien avait 1 pièce de plus, le prix moyen serait de : ${data.variations.plus_one_room ? data.variations.plus_one_room.toLocaleString('fr-FR') + ' €' : 'Pas de données suffisantes'}.
- Impact du terrain : Les biens avec terrain se vendent en moyenne à ${data.variations.with_terrain ? data.variations.with_terrain.toLocaleString('fr-FR') + ' €' : 'N/A'} contre ${data.variations.without_terrain ? data.variations.without_terrain.toLocaleString('fr-FR') + ' €' : 'N/A'} sans terrain.

**Ta mission :**
En te basant strictement sur ces données DVF, rédige-moi un court rapport d'estimation pour mon bien. 
1. Estime la liquidité (le bien se vendra-t-il facilement vu le nombre de transactions similaires ?).
2. Explique si l'agencement actuel (ratio nombre de pièces / surface) est optimal par rapport au marché local (est-ce que des plus petites pièces font perdre de la valeur ?).
3. Conclus avec une fourchette de prix réaliste pour une mise en vente rapide.`;

    return NextResponse.json({
      data,
      ai_prompt: prompt
    });

  } catch (error) {
    console.error('Error executing compare:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la comparaison.' }, { status: 500 });
  }
}
