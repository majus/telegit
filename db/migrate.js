/**
 * Database Migration Runner
 * Runs SQL migration files in order to set up or update the database schema
 */

import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection configuration
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'telegit',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ Migrations tracking table ready');
  } finally {
    client.release();
  }
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.rows.map(row => row.version);
  } finally {
    client.release();
  }
}

/**
 * Get list of available migration files
 */
async function getAvailableMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);

  return files
    .filter(file => file.endsWith('.sql'))
    .sort()
    .map(file => ({
      version: file.replace('.sql', ''),
      file: path.join(migrationsDir, file)
    }));
}

/**
 * Run a single migration
 */
async function runMigration(migration) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read and execute migration SQL
    const sql = await fs.readFile(migration.file, 'utf-8');
    await client.query(sql);

    // Record migration as applied
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [migration.version]
    );

    await client.query('COMMIT');
    console.log(`✓ Applied migration: ${migration.version}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations
 */
async function migrate() {
  try {
    console.log('Starting database migration...\n');

    // Create migrations tracking table
    await createMigrationsTable();

    // Get applied and available migrations
    const appliedMigrations = await getAppliedMigrations();
    const availableMigrations = await getAvailableMigrations();

    // Filter out already applied migrations
    const pendingMigrations = availableMigrations.filter(
      m => !appliedMigrations.includes(m.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✓ Database is up to date. No migrations to run.\n');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s):\n`);

    // Run each pending migration
    for (const migration of pendingMigrations) {
      await runMigration(migration);
    }

    console.log(`\n✓ Successfully applied ${pendingMigrations.length} migration(s)`);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Rollback the last migration
 */
async function rollback() {
  console.log('Rollback functionality not yet implemented.');
  console.log('Please manually revert changes if needed.');
  await pool.end();
}

// Command line interface
const command = process.argv[2];

if (command === 'up' || !command) {
  migrate().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else if (command === 'rollback') {
  rollback().catch(err => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log('Usage: node db/migrate.js [up|rollback]');
  console.log('  up (default): Run all pending migrations');
  console.log('  rollback:     Rollback the last migration');
  process.exit(1);
}
