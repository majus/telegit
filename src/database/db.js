/**
 * PostgreSQL Database Client
 * Provides connection pooling and database access for the application
 */

import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

/**
 * PostgreSQL connection pool
 * Configured with max 20 connections as per PRD requirements
 */
export const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'telegit',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum connection pool size (as per PRD)
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Fail fast if connection takes too long
});

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}

/**
 * Close all database connections
 * Should be called when shutting down the application
 */
export async function closePool() {
  await pool.end();
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    console.error('Query:', text);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * Remember to release the client after use
 * @returns {Promise<pg.PoolClient>} Database client
 */
export async function getClient() {
  return await pool.connect();
}

// Handle unexpected errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Log pool statistics periodically in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });
  }, 60000); // Every minute
}

export default pool;
