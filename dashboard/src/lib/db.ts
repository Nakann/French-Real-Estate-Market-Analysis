import { Pool } from 'pg';

const getConnectionConfig = () => {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'real_estate_db',
  };
};

// Utilisation d'un pattern Singleton pour éviter d'ouvrir trop de pools de connexions en mode dev (hot-reload)
let pool: Pool;

if (process.env.NODE_ENV === 'production') {
  pool = new Pool(getConnectionConfig());
} else {
  if (!(global as any)._postgresPool) {
    (global as any)._postgresPool = new Pool(getConnectionConfig());
  }
  pool = (global as any)._postgresPool;
}

export default pool;
