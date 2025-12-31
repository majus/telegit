/**
 * MongoDB Database Client
 * Provides connection pooling and database access for the application
 */

import { MongoClient, ObjectId } from 'mongodb';
import { getConfig } from '../../config/env.js';
import logger from '../utils/logger.js';

// Get database configuration
const config = getConfig();

/**
 * MongoDB client instance
 * Configured with connection pooling as per PRD requirements
 */
let client = null;
let db = null;

/**
 * Initialize and get MongoDB client
 * @returns {Promise<MongoClient>} MongoDB client instance
 */
export async function getClient() {
  if (!client) {
    client = new MongoClient(config.database.uri, {
      maxPoolSize: config.database.maxPoolSize,
      minPoolSize: config.database.minPoolSize,
      connectTimeoutMS: config.database.connectTimeoutMS,
      socketTimeoutMS: config.database.socketTimeoutMS,
    });
    await client.connect();
    logger.info('MongoDB client connected');
  }
  return client;
}

/**
 * Get database instance
 * @returns {Promise<import('mongodb').Db>} Database instance
 */
export async function getDb() {
  if (!db) {
    const mongoClient = await getClient();
    db = mongoClient.db(config.database.database);
  }
  return db;
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
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

  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB client closed');
  }
}

/**
 * Execute a database operation with timing and error logging
 * @param {string} operationName - Name of the operation for logging
 * @param {Function} operation - Async operation to execute
 * @returns {Promise<any>} Operation result
 */
export async function query(operationName, operation) {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;

    // Log slow queries (>100ms)
    if (duration > 100) {
      logger.warn({ duration, operation: operationName }, 'Slow query detected');
    }

    return result;
  } catch (error) {
    logger.error({ err: error, operation: operationName }, 'Query error');
    throw error;
  }
}

/**
 * Export ObjectId for use in repositories
 */
export { ObjectId };

// Handle unexpected errors
if (client) {
  client.on('error', (err) => {
    logger.error({ err }, 'Unexpected MongoDB client error. Client will attempt to recover. If errors persist, check database connection.');

    // Optionally emit an event for monitoring systems to catch
    if (process.listenerCount('databaseError') > 0) {
      process.emit('databaseError', err);
    }
  });
}

// Log pool statistics periodically in development
if (config.app.nodeEnv === 'development') {
  statsIntervalId = setInterval(async () => {
    if (client) {
      try {
        const database = await getDb();
        const serverStatus = await database.admin().serverStatus();
        logger.debug({
          connections: serverStatus.connections,
        }, 'MongoDB connection stats');
      } catch (error) {
        // Ignore errors in stats logging
      }
    }
  }, 60000); // Every minute

  // Prevent interval from keeping process alive
  if (statsIntervalId && statsIntervalId.unref) {
    statsIntervalId.unref();
  }
}

export default { getClient, getDb, testConnection, closePool, query, ObjectId };
