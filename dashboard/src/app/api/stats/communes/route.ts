import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json([]);

  try {
    const res = await pool.query(`
      SELECT 
        code_commune,
        nom_commune AS nom,
        LEFT(code_commune, 2) AS code_departement,
        COALESCE(nb_mutations, 0) AS nb_transactions
      FROM gold.fact_communes
      WHERE nom_commune ILIKE $1
      ORDER BY nb_transactions DESC
      LIMIT 10
    `, [`%${q}%`]);

    return NextResponse.json(res.rows);
  } catch (err) {
    console.error('Stats Communes API Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
