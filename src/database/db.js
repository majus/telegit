/**
 * PostgreSQL Database Client
 * Provides connection pooling and database access for the application
 */

import pg from 'pg';
import { getConfig } from '../../config/env.js';
import logger from '../utils/logger.js';

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
    logger.error({ err: error }, 'Database connection test failed');
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
      logger.warn({ duration, query: text.substring(0, 100) }, 'Slow query detected');
    }

    return result;
  } catch (error) {
    logger.error({ err: error, query: text }, 'Query error');
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
  logger.error({ err }, 'Unexpected error on idle client. Pool will attempt to recover. If errors persist, check database connection.');

  // Optionally emit an event for monitoring systems to catch
  if (process.listenerCount('databaseError') > 0) {
    process.emit('databaseError', err);
  }
});

// Log pool statistics periodically in development
if (config.app.nodeEnv === 'development') {
  statsIntervalId = setInterval(() => {
    logger.debug({
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    }, 'Pool stats');
  }, 60000); // Every minute

  // Prevent interval from keeping process alive
  statsIntervalId.unref();
}

export default pool;
