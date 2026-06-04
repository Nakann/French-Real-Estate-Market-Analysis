import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commune = searchParams.get('commune')?.trim() || '';

  if (!commune) {
    return NextResponse.json({ error: 'Missing commune parameter' }, { status: 400 });
  }

  try {
    const res = await pool.query(`
      SELECT DISTINCT code_iris, nom_iris
      FROM gold.fact_immobilier
      WHERE code_commune = $1
        AND code_iris IS NOT NULL
      ORDER BY nom_iris ASC
    `, [commune]);

    return NextResponse.json(res.rows);
  } catch (err) {
    console.error('Stats IRIS API Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
