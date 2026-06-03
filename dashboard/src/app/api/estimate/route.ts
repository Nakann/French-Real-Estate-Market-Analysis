import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code_commune, surface, valeur, type_local, etiquette_dpe, code_iris, street } = body;

    // Validation des données entrantes
    if (!code_commune || !surface || !valeur || !type_local) {
      return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
    }

    const numSurface = parseFloat(surface);
    const numValeur = parseFloat(valeur);

    if (isNaN(numSurface) || numSurface <= 0 || isNaN(numValeur) || numValeur <= 0) {
      return NextResponse.json({ error: 'Valeurs numériques invalides.' }, { status: 400 });
    }

    const userPriceM2 = numValeur / numSurface;

    let resolvedAvgPriceM2 = 0;
    let resolvedTransactionCount = 0;
    let estimationLevel = 'commune';
    let levelName = '';

    // Query 1: Commune level stats (as baseline and fallback)
    const communeStatsPromise = pool.query(`
      SELECT AVG(prix_m2) as avg_price_m2, COUNT(*)::int as transaction_count
      FROM gold.fact_immobilier
      WHERE code_commune = $1 
        AND type_local = $2 
        AND prix_m2 IS NOT NULL
    `, [code_commune, type_local]);

    // Query 2: IRIS level stats (if code_iris provided)
    let irisStatsPromise = Promise.resolve({ rows: [] as any[] });
    if (code_iris) {
      irisStatsPromise = pool.query(`
        SELECT AVG(prix_m2) as avg_price_m2, COUNT(*)::int as transaction_count, MAX(nom_iris) as nom_iris
        FROM gold.fact_immobilier
        WHERE code_commune = $1 
          AND type_local = $2 
          AND code_iris = $3 
          AND prix_m2 IS NOT NULL
        GROUP BY code_iris
      `, [code_commune, type_local, code_iris]);
    }

    // Query 3: Street level stats (if street provided)
    let streetStatsPromise = Promise.resolve({ rows: [] as any[] });
    if (street) {
      streetStatsPromise = pool.query(`
        SELECT AVG(prix_m2) as avg_price_m2, COUNT(*)::int as transaction_count
        FROM gold.fact_immobilier
        WHERE code_commune = $1 
          AND type_local = $2 
          AND REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') = $3
          AND prix_m2 IS NOT NULL
      `, [code_commune, type_local, street]);
    }

    const [communeRes, irisRes, streetRes] = await Promise.all([
      communeStatsPromise,
      irisStatsPromise,
      streetStatsPromise
    ]);

    const communeStats = communeRes.rows[0] || { avg_price_m2: null, transaction_count: 0 };
    const irisStats = irisRes.rows[0] || { avg_price_m2: null, transaction_count: 0, nom_iris: '' };
    const streetStats = streetRes.rows[0] || { avg_price_m2: null, transaction_count: 0 };

    const communePrice = communeStats.avg_price_m2 ? parseFloat(communeStats.avg_price_m2) : null;
    const irisPrice = irisStats.avg_price_m2 ? parseFloat(irisStats.avg_price_m2) : null;
    const streetPrice = streetStats.avg_price_m2 ? parseFloat(streetStats.avg_price_m2) : null;

    // Check street first, then iris, then commune
    if (street && streetStats.transaction_count >= 3 && streetPrice) {
      resolvedAvgPriceM2 = streetPrice;
      resolvedTransactionCount = streetStats.transaction_count;
      estimationLevel = 'street';
      levelName = street;
    } else if (code_iris && irisStats.transaction_count >= 3 && irisPrice) {
      resolvedAvgPriceM2 = irisPrice;
      resolvedTransactionCount = irisStats.transaction_count;
      estimationLevel = 'iris';
      levelName = irisStats.nom_iris || code_iris;
    } else {
      if (!communePrice) {
        return NextResponse.json({ 
          error: "Pas assez de données de ventes historiques pour cette commune et ce type de bien." 
        }, { status: 404 });
      }
      resolvedAvgPriceM2 = communePrice;
      resolvedTransactionCount = communeStats.transaction_count;
      estimationLevel = 'commune';

      // Load commune name
      const nameRes = await pool.query(`SELECT nom_commune FROM gold.fact_communes WHERE code_commune = $1`, [code_commune]);
      levelName = nameRes.rows[0]?.nom_commune || code_commune;
    }

    // 2. Récupérer les stats socio-économiques INSEE de la commune
    const socioResult = await pool.query(`
      SELECT niveau_vie_median, taux_pauvrete
      FROM gold.stg_filosofi
      WHERE code_commune = $1
    `, [code_commune]);

    const socio = socioResult.rows[0] || null;

    // 3. Récupérer la performance DPE moyenne au niveau résolu (ou commune en repli)
    let dpeClause = `WHERE code_commune = $1 AND type_local = $2 AND NULLIF(consommation_energie, '') IS NOT NULL`;
    const dpeParams: any[] = [code_commune, type_local];
    if (estimationLevel === 'street') {
      dpeClause += ` AND REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') = $3`;
      dpeParams.push(street);
    } else if (estimationLevel === 'iris') {
      dpeClause += ` AND code_iris = $3`;
      dpeParams.push(code_iris);
    }

    const dpeRes = await pool.query(`
      SELECT AVG(CAST(NULLIF(consommation_energie, '') AS NUMERIC)) as avg_conso
      FROM gold.fact_immobilier
      ${dpeClause}
    `, dpeParams);

    let avgConso = dpeRes.rows[0]?.avg_conso ? parseFloat(dpeRes.rows[0].avg_conso) : null;
    
    if (avgConso === null && estimationLevel !== 'commune') {
      const fallbackDpeRes = await pool.query(`
        SELECT AVG(CAST(NULLIF(consommation_energie, '') AS NUMERIC)) as avg_conso
        FROM gold.fact_immobilier
        WHERE code_commune = $1 AND type_local = $2 AND NULLIF(consommation_energie, '') IS NOT NULL
      `, [code_commune, type_local]);
      avgConso = fallbackDpeRes.rows[0]?.avg_conso ? parseFloat(fallbackDpeRes.rows[0].avg_conso) : null;
    }

    // 4. Calcul de l'évaluation
    const percentageDiff = ((userPriceM2 - resolvedAvgPriceM2) / resolvedAvgPriceM2) * 100;
    
    let status = 'fair_price';
    let label = 'Prix du marché';
    
    if (percentageDiff < -15) {
      status = 'excellent_deal';
      label = 'Excellente affaire !';
    } else if (percentageDiff < -5) {
      status = 'good_deal';
      label = 'Bon coup';
    } else if (percentageDiff > 30) {
      status = 'overpriced';
      label = 'Surévalué';
    } else if (percentageDiff > 15) {
      status = 'too_expensive';
      label = 'Trop cher';
    }

    return NextResponse.json({
      user_price_m2: Math.round(userPriceM2),
      average_price_m2: Math.round(resolvedAvgPriceM2),
      percentage_diff: Math.round(percentageDiff * 10) / 10,
      status,
      label,
      transaction_count: resolvedTransactionCount,
      estimation_level: estimationLevel,
      level_name: levelName,
      commune_price_m2: communePrice ? Math.round(communePrice) : null,
      socio: socio ? {
        niveau_vie_median: socio.niveau_vie_median ? Math.round(parseFloat(socio.niveau_vie_median)) : null,
        taux_pauvrete: socio.taux_pauvrete ? parseFloat(socio.taux_pauvrete) : null,
      } : null,
      dpe: {
        user_dpe: etiquette_dpe,
        avg_conso: avgConso ? Math.round(avgConso) : null
      }
    });

  } catch (error) {
    console.error('Error executing price estimation:', error);
    return NextResponse.json({ error: 'Erreur serveur lors du calcul de l\'estimation.' }, { status: 500 });
  }
}
