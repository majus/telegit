/**
 * Test helpers for database operations
 * Provides utilities for testing database functionality
 */

import { vi } from 'vitest';
import pg from 'pg';

const { Pool } = pg;

/**
 * Create a mock database pool for testing
 * @returns {object} Mock pool with common methods
 */
export function createMockPool() {
  const pool = {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn().mockResolvedValue(undefined),
  };

  // Mock client for transactions
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };

  pool.connect.mockResolvedValue(mockClient);

  return {
    pool,
    mockClient,
  };
}

/**
 * Create a mock query result
 * @param {Array} rows - Rows to return
 * @param {string} command - SQL command (SELECT, INSERT, etc.)
 * @returns {object} Mock query result
 */
export function mockQueryResult(rows = [], command = 'SELECT') {
  return {
    rows,
    rowCount: rows.length,
    command,
    oid: null,
    fields: [],
  };
}

/**
 * Setup mock responses for common database queries
 * @param {object} pool - Mock pool instance
 * @param {object} responses - Query responses keyed by query pattern
 */
export function setupMockQueries(pool, responses) {
  pool.query.mockImplementation((query) => {
    const sql = typeof query === 'string' ? query : query.text;

    for (const [pattern, response] of Object.entries(responses)) {
      if (sql.includes(pattern)) {
        return Promise.resolve(response);
      }
    }

    // Default response
    return Promise.resolve(mockQueryResult([]));
  });
}

/**
 * Assert that a query was executed with specific parameters
 * @param {object} pool - Mock pool instance
 * @param {string} expectedQuery - Expected query pattern
 * @param {Array} expectedParams - Expected parameters (optional)
 */
export function assertQueryExecuted(pool, expectedQuery, expectedParams = null) {
  const calls = pool.query.mock.calls;
  const found = calls.some(([query, params]) => {
    const sql = typeof query === 'string' ? query : query.text;
    const queryParams = typeof query === 'string' ? params : query.values;

    const queryMatches = sql.includes(expectedQuery);
    const paramsMatch = expectedParams === null ||
      JSON.stringify(queryParams) === JSON.stringify(expectedParams);

    return queryMatches && paramsMatch;
  });

  if (!found) {
    throw new Error(
      `Expected query containing "${expectedQuery}" to be executed${
        expectedParams ? ` with params ${JSON.stringify(expectedParams)}` : ''
      }, but it was not found in:\n${
        calls.map(c => `  - ${typeof c[0] === 'string' ? c[0] : c[0].text}`).join('\n')
      }`
    );
  }
}

/**
 * Create a test database connection (for integration tests)
 * Uses test database configuration
 * @returns {Pool} Database pool
 */
export function createTestPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

/**
 * Clean up test database tables
 * @param {Pool} pool - Database pool
 * @param {Array<string>} tables - Table names to truncate
 */
export async function cleanupTestDB(pool, tables = []) {
  const allTables = tables.length > 0 ? tables : [
    'message_classifications',
    'github_issues',
    'telegram_messages',
    'bot_state',
  ];

  for (const table of allTables) {
    await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
  }
}

/**
 * Seed test database with sample data
 * @param {Pool} pool - Database pool
 * @param {object} data - Data to seed
 */
export async function seedTestDB(pool, data) {
  if (data.telegramMessages) {
    for (const msg of data.telegramMessages) {
      await pool.query(
        `INSERT INTO telegram_messages
         (id, telegram_message_id, chat_id, user_id, username, first_name, last_name, message_text, message_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          msg.id,
          msg.telegram_message_id,
          msg.chat_id,
          msg.user_id,
          msg.username,
          msg.first_name,
          msg.last_name,
          msg.message_text,
          msg.message_date,
        ]
      );
    }
  }

  if (data.githubIssues) {
    for (const issue of data.githubIssues) {
      await pool.query(
        `INSERT INTO github_issues
         (id, telegram_message_id, github_issue_number, github_issue_url, issue_title, issue_body, issue_state, labels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          issue.id,
          issue.telegram_message_id,
          issue.github_issue_number,
          issue.github_issue_url,
          issue.issue_title,
          issue.issue_body,
          issue.issue_state,
          JSON.stringify(issue.labels),
        ]
      );
    }
  }
}
