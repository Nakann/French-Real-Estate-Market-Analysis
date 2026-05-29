import { Pool } from 'pg';

// Utilisation d'un pattern Singleton pour éviter d'ouvrir trop de pools de connexions en mode dev (hot-reload)
let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  if (!(global as any)._postgresPool) {
    (global as any)._postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  pool = (global as any)._postgresPool;
}

export default pool;
