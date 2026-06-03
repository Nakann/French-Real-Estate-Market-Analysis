import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  if (q.length < 2) return NextResponse.json([]);

  try {
    const res = await pool.query(`
      SELECT DISTINCT
        code_commune,
        INITCAP(SPLIT_PART(adresse_complete, ' ', array_length(string_to_array(adresse_complete, ' '), 1))) AS nom,
        code_departement
      FROM gold.fact_immobilier
      WHERE adresse_complete ILIKE $1
        AND adresse_complete IS NOT NULL
      LIMIT 10
    `, [`%${q}%`]);

    // Simpler approach: get distinct commune codes and reconstruct names
    const res2 = await pool.query(`
      SELECT DISTINCT ON (code_commune)
        code_commune,
        code_departement,
        COUNT(*) OVER (PARTITION BY code_commune)::int AS nb_transactions
      FROM gold.fact_immobilier
      WHERE code_commune IS NOT NULL
      ORDER BY code_commune, nb_transactions DESC
      LIMIT 5
    `);

    return NextResponse.json(res.rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
