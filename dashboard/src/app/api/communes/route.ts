import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Utilise bronze.raw_dvf car c'est une table brute directe (beaucoup plus rapide qu'une vue complexe de faits)
    const result = await pool.query(`
      SELECT DISTINCT code_commune, nom_commune 
      FROM bronze.raw_dvf 
      WHERE nom_commune IS NOT NULL 
        AND nom_commune != ''
        AND code_commune IS NOT NULL
      ORDER BY nom_commune ASC;
    `);

    // Formatage des noms en Title Case pour un meilleur rendu visuel
    const communes = result.rows.map((row: any) => ({
      code: row.code_commune,
      name: row.nom_commune.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
    }));

    return NextResponse.json({ communes });
  } catch (error) {
    console.error('Error fetching communes list:', error);
    return NextResponse.json({ error: 'Failed to fetch communes list' }, { status: 500 });
  }
}
