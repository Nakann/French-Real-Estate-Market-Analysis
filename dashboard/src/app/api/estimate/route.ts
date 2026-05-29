import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code_commune, surface, valeur, type_local, etiquette_dpe } = body;

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

    // 1. Récupérer le prix moyen local (m2) dans DVF
    // On utilise un cast robuste car les colonnes brutes de bronze sont de type TEXT
    const dvfResult = await pool.query(`
      SELECT 
        AVG(CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC) / NULLIF(CAST(surface_reelle_bati AS NUMERIC), 0)) as avg_price_m2,
        COUNT(*) as transaction_count
      FROM bronze.raw_dvf
      WHERE code_commune = $1
        AND type_local = $2
        AND NULLIF(surface_reelle_bati, '') IS NOT NULL
        AND CAST(surface_reelle_bati AS NUMERIC) > 0
        AND NULLIF(valeur_fonciere, '') IS NOT NULL
        -- Filtre sur les valeurs aberrantes pour nettoyer les calculs de moyenne
        AND (CAST(REPLACE(valeur_fonciere, ',', '.') AS NUMERIC) / CAST(surface_reelle_bati AS NUMERIC)) BETWEEN 300 AND 30000
    `, [code_commune, type_local]);

    const dbAvgPriceM2 = dvfResult.rows[0]?.avg_price_m2;
    const transactionCount = parseInt(dvfResult.rows[0]?.transaction_count || '0');

    if (!dbAvgPriceM2) {
      return NextResponse.json({ 
        error: "Pas assez de données de ventes historiques pour cette commune et ce type de bien." 
      }, { status: 404 });
    }

    const avgPriceM2 = parseFloat(dbAvgPriceM2);

    // 2. Récupérer les stats socio-économiques INSEE de la commune
    const socioResult = await pool.query(`
      SELECT niveau_vie_median, taux_pauvrete, indice_gini
      FROM gold.stg_filosofi
      WHERE code_commune = $1
    `, [code_commune]);

    const socio = socioResult.rows[0] || null;

    // 3. Récupérer la performance DPE moyenne de la commune pour ce type de bâtiment
    const dpeResult = await pool.query(`
      SELECT 
        AVG(NULLIF(CAST(conso_5_usages_par_m2_ep AS NUMERIC), 0)) as avg_conso
      FROM bronze.raw_dpe
      WHERE code_insee_ban = $1
        AND type_batiment = $2
        AND NULLIF(conso_5_usages_par_m2_ep, '') IS NOT NULL
    `, [code_commune, type_local]);

    const avgConso = dpeResult.rows[0]?.avg_conso ? parseFloat(dpeResult.rows[0].avg_conso) : null;

    // 4. Calcul de l'évaluation
    const percentageDiff = ((userPriceM2 - avgPriceM2) / avgPriceM2) * 100;
    
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
      average_price_m2: Math.round(avgPriceM2),
      percentage_diff: Math.round(percentageDiff * 10) / 10,
      status,
      label,
      transaction_count: transactionCount,
      socio: socio ? {
        niveau_vie_median: socio.niveau_vie_median ? Math.round(parseFloat(socio.niveau_vie_median)) : null,
        taux_pauvrete: socio.taux_pauvrete ? parseFloat(socio.taux_pauvrete) : null,
        indice_gini: socio.indice_gini ? parseFloat(socio.indice_gini) : null,
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
