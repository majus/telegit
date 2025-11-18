/**
 * PostgreSQL Database Client
 * Provides connection pooling and database access for the application
 */

import pg from 'pg';
import { getConfig } from '../../config/env.js';

const { Pool } = pg;

// Get database configuration
const config = getConfig();

/**
 * PostgreSQL connection pool
 * Configured with max 20 connections as per PRD requirements
 */
export const pool = new Pool(config.database);

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

// Store interval ID for cleanup
let statsIntervalId = null;

/**
 * Close all database connections
 * Should be called when shutting down the application
 */
export async function closePool() {
  // Clear stats interval if running
  if (statsIntervalId) {
    clearInterval(statsIntervalId);
    statsIntervalId = null;
  }
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

// Handle unexpected errors - log and attempt recovery instead of crashing
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
  console.error('Pool will attempt to recover. If errors persist, check database connection.');

  // Optionally emit an event for monitoring systems to catch
  if (process.listenerCount('databaseError') > 0) {
    process.emit('databaseError', err);
  }
});

// Log pool statistics periodically in development
if (config.app.nodeEnv === 'development') {
  statsIntervalId = setInterval(() => {
    console.log('Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });
  }, 60000); // Every minute

  // Prevent interval from keeping process alive
  statsIntervalId.unref();
}

export default pool;
