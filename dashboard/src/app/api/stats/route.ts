import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commune = searchParams.get('commune')?.trim() || '';
  const iris = searchParams.get('iris')?.trim() || '';
  const type = searchParams.get('type') || 'all';
  const yearMin = parseInt(searchParams.get('yearMin') || '2021');
  const yearMax = parseInt(searchParams.get('yearMax') || '2025');

  // Build WHERE clauses as parameterized strings
  // We'll use positional params properly
  const params: (string | number)[] = [yearMin, yearMax];
  let paramIdx = 3;

  let communeClause = '';
  if (commune) {
    communeClause = `AND (adresse_complete ILIKE $${paramIdx} OR code_commune = $${paramIdx + 1})`;
    params.push(`%${commune}%`, commune);
    paramIdx += 2;
  }

  let irisClause = '';
  if (iris) {
    irisClause = `AND code_iris = $${paramIdx}`;
    params.push(iris);
    paramIdx += 1;
  }

  let typeClause = '';
  if (type !== 'all') {
    typeClause = `AND type_local = $${paramIdx}`;
    params.push(type);
    paramIdx += 1;
  }

  const baseWhere = `
    WHERE EXTRACT(YEAR FROM date_mutation) BETWEEN $1 AND $2
      ${communeClause}
      ${irisClause}
      ${typeClause}
      AND prix_m2 IS NOT NULL
      AND prix_m2 BETWEEN 500 AND 25000
  `;

  // Custom params for the socio-economic query (only filter by commune or iris, not local type)
  const socioParams: (string | number)[] = [yearMin, yearMax];
  let socioClause = '';
  if (iris) {
    socioClause = `AND code_iris = $3`;
    socioParams.push(iris);
  } else if (commune) {
    socioClause = `AND code_commune = $3`;
    socioParams.push(commune);
  }

  try {
    const [kpis, evolution, dpe, histo, socio] = await Promise.all([
      // 1. KPIs globaux
      pool.query(`
        SELECT
          COUNT(*)::int                                          AS nb_transactions,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_m2)  AS prix_median_m2,
          ROUND(AVG(surface_reelle_bati)::numeric, 1)           AS surface_moyenne,
          COUNT(*) FILTER (WHERE etiquette_dpe IS NOT NULL)::int AS nb_avec_dpe,
          ROUND(AVG(valeur_fonciere)::numeric, 0)               AS prix_moyen
        FROM gold.fact_immobilier
        ${baseWhere}
      `, params),

      // 2. Evolution trimestrielle
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('quarter', date_mutation), 'YYYY "T"Q') AS periode,
          DATE_TRUNC('quarter', date_mutation)                         AS date_sort,
          type_local,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY prix_m2)::numeric, 0) AS prix_median,
          COUNT(*)::int                                                              AS nb
        FROM gold.fact_immobilier
        ${baseWhere}
        GROUP BY DATE_TRUNC('quarter', date_mutation), type_local
        ORDER BY date_sort ASC
      `, params),

      // 3. Distribution DPE
      pool.query(`
        SELECT
          etiquette_dpe AS dpe,
          COUNT(*)::int  AS nb,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
        FROM gold.fact_immobilier
        WHERE EXTRACT(YEAR FROM date_mutation) BETWEEN $1 AND $2
          ${communeClause}
          ${irisClause}
          ${typeClause}
          AND etiquette_dpe IS NOT NULL
        GROUP BY etiquette_dpe
        ORDER BY etiquette_dpe
      `, params),

      // 4. Histogramme prix au m2
      pool.query(`
        SELECT
          CASE
            WHEN prix_m2 < 1000  THEN '< 1 000'
            WHEN prix_m2 < 2000  THEN '1 000-2 000'
            WHEN prix_m2 < 3000  THEN '2 000-3 000'
            WHEN prix_m2 < 4000  THEN '3 000-4 000'
            WHEN prix_m2 < 5000  THEN '4 000-5 000'
            WHEN prix_m2 < 7000  THEN '5 000-7 000'
            ELSE                       '> 7 000'
          END AS tranche,
          CASE
            WHEN prix_m2 < 1000  THEN 1
            WHEN prix_m2 < 2000  THEN 2
            WHEN prix_m2 < 3000  THEN 3
            WHEN prix_m2 < 4000  THEN 4
            WHEN prix_m2 < 5000  THEN 5
            WHEN prix_m2 < 7000  THEN 6
            ELSE                       7
          END AS ordre,
          type_local,
          COUNT(*)::int AS nb
        FROM gold.fact_immobilier
        ${baseWhere}
        GROUP BY tranche, ordre, type_local
        ORDER BY ordre, type_local
      `, params),

      // 5. Socio-économique
      pool.query(`
        SELECT
          ROUND(AVG(niveau_vie_median)::numeric, 0) AS niveau_vie_median,
          ROUND(AVG(taux_pauvrete)::numeric, 1)     AS taux_pauvrete
        FROM gold.fact_immobilier
        WHERE EXTRACT(YEAR FROM date_mutation) BETWEEN $1 AND $2
          ${socioClause}
          AND niveau_vie_median IS NOT NULL
      `, socioParams),
    ]);

    return NextResponse.json({
      kpis: kpis.rows[0] ?? null,
      evolution: evolution.rows,
      dpe: dpe.rows,
      histo: histo.rows,
      socio: socio.rows[0] ?? null,
    });

  } catch (err) {
    console.error('Stats API Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
