import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commune = searchParams.get('commune')?.trim() || '';
  const iris = searchParams.get('iris')?.trim() || '';
  const q = searchParams.get('q')?.trim() || '';

  if (!commune) {
    return NextResponse.json({ error: 'Missing commune parameter' }, { status: 400 });
  }

  try {
    const hasSearch = q.length >= 2;
    const searchPattern = hasSearch ? `%${q}%` : '';

    const res = await pool.query(`
      SELECT 
        REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') AS nom_voie,
        COUNT(*)::int as transaction_count
      FROM gold.fact_immobilier
      WHERE code_commune = $1
        AND (code_iris = $2 OR $2 = '' OR $2 IS NULL)
        AND ($3 = FALSE OR REGEXP_REPLACE(adresse_complete, '^[0-9]+[A-Za-z]?\\s+', '') ILIKE $4)
      GROUP BY nom_voie
      ORDER BY 
        CASE WHEN $3 = FALSE THEN COUNT(*) ELSE 0 END DESC,
        nom_voie ASC
      LIMIT 15
    `, [commune, iris, hasSearch, searchPattern]);

    return NextResponse.json(res.rows);
  } catch (err) {
    console.error('Stats Streets API Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
