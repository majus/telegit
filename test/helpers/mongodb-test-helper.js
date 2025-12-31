/**
 * MongoDB Test Helper
 * Provides utilities for testing with MongoMemoryServer
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

let mongoServer = null;
let mongoClient = null;
let db = null;

/**
 * Start MongoDB Memory Server and connect
 * @param {string} [dbName='test'] - Database name
 * @returns {Promise<Object>} Database instance and client
 */
export async function startMongoServer(dbName = 'test') {
  if (mongoServer) {
    // Already started
    return { db, client: mongoClient };
  }

  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Connect client
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();

  // Get database
  db = mongoClient.db(dbName);

  return { db, client: mongoClient };
}

/**
 * Stop MongoDB Memory Server and close connections
 * @returns {Promise<void>}
 */
export async function stopMongoServer() {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }

  db = null;
}

/**
 * Get current database instance
 * @returns {Object|null} Database instance
 */
export function getTestDb() {
  return db;
}

/**
 * Get current MongoClient instance
 * @returns {Object|null} MongoClient instance
 */
export function getTestClient() {
  return mongoClient;
}

/**
 * Clear all collections in the test database
 * @returns {Promise<void>}
 */
export async function clearDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call startMongoServer() first.');
  }

  const collections = await db.listCollections().toArray();

  for (const collection of collections) {
    await db.collection(collection.name).deleteMany({});
  }
}

/**
 * Drop all collections in the test database
 * @returns {Promise<void>}
 */
export async function dropDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call startMongoServer() first.');
  }

  await db.dropDatabase();
}

/**
 * Insert test data into a collection
 * @param {string} collectionName - Name of the collection
 * @param {Array|Object} data - Data to insert (single document or array)
 * @returns {Promise<Object>} Insert result
 */
export async function insertTestData(collectionName, data) {
  if (!db) {
    throw new Error('Database not initialized. Call startMongoServer() first.');
  }

  const collection = db.collection(collectionName);

  if (Array.isArray(data)) {
    return await collection.insertMany(data);
  } else {
    return await collection.insertOne(data);
  }
}

/**
 * Get all documents from a collection
 * @param {string} collectionName - Name of the collection
 * @param {Object} [query={}] - Query filter
 * @returns {Promise<Array>} Array of documents
 */
export async function getAllDocuments(collectionName, query = {}) {
  if (!db) {
    throw new Error('Database not initialized. Call startMongoServer() first.');
  }

  const collection = db.collection(collectionName);
  return await collection.find(query).toArray();
}

/**
 * Create indexes for a collection
 * @param {string} collectionName - Name of the collection
 * @param {Array} indexes - Array of index specifications
 * @returns {Promise<void>}
 */
export async function createIndexes(collectionName, indexes) {
  if (!db) {
    throw new Error('Database not initialized. Call startMongoServer() first.');
  }

  const collection = db.collection(collectionName);

  for (const index of indexes) {
    await collection.createIndex(index.key, index.options || {});
  }
}

export default {
  startMongoServer,
  stopMongoServer,
  getTestDb,
  getTestClient,
  clearDatabase,
  dropDatabase,
  insertTestData,
  getAllDocuments,
  createIndexes,
};
