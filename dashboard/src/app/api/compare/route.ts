import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code_commune, type_local, surface, pieces, has_terrain, has_dependance, code_iris, street } = body;

    if (!code_commune || !surface || !pieces || !type_local) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    const s = parseFloat(surface);
    const p = parseInt(pieces, 10);
    const minS = s * 0.85;
    const maxS = s * 1.15;

    // 1. Determine level of comparison
    const countParams = [code_commune, type_local, minS, maxS, p];
    
    // Check commune count
    const communeCountPromise = pool.query(`
      SELECT COUNT(*)::int as cnt
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2
        AND surface_reelle_bati BETWEEN $3 AND $4
        AND nombre_pieces_principales = $5
        AND prix_m2 IS NOT NULL
    `, countParams);

    // Check IRIS count (if code_iris provided)
    let irisCountPromise = Promise.resolve({ rows: [] as any[] });
    if (code_iris) {
      irisCountPromise = pool.query(`
        SELECT COUNT(*)::int as cnt, MAX(nom_iris) as nom_iris
        FROM gold.fact_immobilier
        WHERE code_commune = $1 
          AND type_local = $2
          AND surface_reelle_bati BETWEEN $3 AND $4
          AND nombre_pieces_principales = $5
          AND code_iris = $6
          AND prix_m2 IS NOT NULL
      `, [...countParams, code_iris]);
    }

    // Check street count (if street provided)
    let streetCountPromise = Promise.resolve({ rows: [] as any[] });
    if (street) {
      streetCountPromise = pool.query(`
        SELECT COUNT(*)::int as cnt
        FROM gold.fact_immobilier
        WHERE code_commune = $1 
          AND type_local = $2
          AND surface_reelle_bati BETWEEN $3 AND $4
          AND nombre_pieces_principales = $5
          AND REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') = $6
          AND prix_m2 IS NOT NULL
      `, [...countParams, street]);
    }

    const [communeCntRes, irisCntRes, streetCntRes] = await Promise.all([
      communeCountPromise,
      irisCountPromise,
      streetCountPromise
    ]);

    const communeCnt = communeCntRes.rows[0]?.cnt || 0;
    const irisCnt = irisCntRes.rows[0]?.cnt || 0;
    const streetCnt = streetCntRes.rows[0]?.cnt || 0;

    let resolvedLevel = 'commune';
    let levelName = '';

    if (street && streetCnt >= 3) {
      resolvedLevel = 'street';
      levelName = street;
    } else if (code_iris && irisCnt >= 3) {
      resolvedLevel = 'iris';
      levelName = irisCntRes.rows[0]?.nom_iris || code_iris;
    } else {
      resolvedLevel = 'commune';
      const nameRes = await pool.query(`SELECT nom_commune FROM gold.fact_communes WHERE code_commune = $1`, [code_commune]);
      levelName = nameRes.rows[0]?.nom_commune || code_commune;
    }

    // 2. Fetch comparables at resolved level
    let levelClause = '';
    const queryParams: any[] = [code_commune, type_local, minS, maxS];
    let nextIdx = 5;

    if (resolvedLevel === 'street') {
      levelClause = `AND REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') = $5`;
      queryParams.push(street);
      nextIdx = 6;
    } else if (resolvedLevel === 'iris') {
      levelClause = `AND code_iris = $5`;
      queryParams.push(code_iris);
      nextIdx = 6;
    }

    const exactPromise = pool.query(`
      SELECT 
        COUNT(*)::int as nb_biens,
        AVG(prix_m2) as avg_prix_m2,
        AVG(valeur_fonciere) as avg_prix_total
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2
        AND surface_reelle_bati BETWEEN $3 AND $4
        AND nombre_pieces_principales = $${nextIdx}
        AND prix_m2 IS NOT NULL
        ${levelClause}
    `, [...queryParams, p]);

    const minusOnePromise = pool.query(`
      SELECT AVG(valeur_fonciere) as avg_prix_total
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2
        AND surface_reelle_bati BETWEEN $3 AND $4
        AND nombre_pieces_principales = $${nextIdx}
        AND prix_m2 IS NOT NULL
        ${levelClause}
    `, [...queryParams, p > 1 ? p - 1 : 0]);

    const plusOnePromise = pool.query(`
      SELECT AVG(valeur_fonciere) as avg_prix_total
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2
        AND surface_reelle_bati BETWEEN $3 AND $4
        AND nombre_pieces_principales = $${nextIdx}
        AND prix_m2 IS NOT NULL
        ${levelClause}
    `, [...queryParams, p + 1]);

    const terrainPromise = type_local === 'Maison' ? pool.query(`
      SELECT 
        CASE WHEN surface_terrain IS NOT NULL AND surface_terrain > 0 THEN 'avec_terrain' ELSE 'sans_terrain' END as a_terrain,
        AVG(valeur_fonciere) as avg_prix_total
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2
        AND surface_reelle_bati BETWEEN $3 AND $4
        AND prix_m2 IS NOT NULL
        ${levelClause}
      GROUP BY 1
    `, queryParams) : Promise.resolve({ rows: [] as any[] });

    const [exactRes, minusOneRes, plusOneRes, terrainRes] = await Promise.all([
      exactPromise,
      minusOnePromise,
      plusOnePromise,
      terrainPromise
    ]);

    const exact = exactRes.rows[0] || { nb_biens: 0, avg_prix_m2: null, avg_prix_total: null };
    const minusOne = minusOneRes.rows[0] || { avg_prix_total: null };
    const plusOne = plusOneRes.rows[0] || { avg_prix_total: null };
    
    let prixAvecTerrain = null;
    let prixSansTerrain = null;
    terrainRes.rows.forEach((r: any) => {
      if (r.a_terrain === 'avec_terrain') prixAvecTerrain = r.avg_prix_total;
      if (r.a_terrain === 'sans_terrain') prixSansTerrain = r.avg_prix_total;
    });

    const data = {
      exact: {
        nb_biens: exact.nb_biens,
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
    const prompt = `Agis comme un expert immobilier de renom. Je souhaite avoir ton analyse sur un bien situé à l'échelle de la zone géographique : ${levelName} (niveau de granularité résolu : ${resolvedLevel}).

**Caractéristiques du bien cible :**
- Type: ${type_local}
- Surface: ${surface} m²
- Nombre de pièces: ${pieces}
- Terrain/Jardin: ${has_terrain ? 'Oui' : 'Non'}
- Dépendances: ${has_dependance ? 'Oui' : 'Non'}

**Données réelles du marché local (issues des Demandes de Valeurs Foncières - DVF) à l'échelle du secteur (${levelName}) :**
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
      resolved_level: resolvedLevel,
      level_name: levelName,
      ai_prompt: prompt
    });

  } catch (error) {
    console.error('Error executing compare:', error);
    return NextResponse.json({ error: 'Erreur serveur lors de la comparaison.' }, { status: 500 });
  }
}
