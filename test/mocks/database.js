/**
 * Mock data generators for database entities
 * Using @faker-js/faker for realistic test data
 */

import { faker } from '@faker-js/faker';
import { mockTelegramMessage } from './telegram.js';
import { mockGitHubIssue } from './github.js';

/**
 * Generate a mock TelegramMessage database record
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock database record
 */
export function mockDBTelegramMessage(overrides = {}) {
  const message = mockTelegramMessage();

  return {
    id: faker.string.uuid(),
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    user_id: message.from.id,
    username: message.from.username,
    first_name: message.from.first_name,
    last_name: message.from.last_name,
    message_text: message.text,
    message_date: new Date(message.date * 1000),
    reply_to_message_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock GitHubIssue database record
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock database record
 */
export function mockDBGitHubIssue(overrides = {}) {
  const issue = mockGitHubIssue();

  return {
    id: faker.string.uuid(),
    telegram_message_id: faker.string.uuid(),
    github_issue_number: issue.number,
    github_issue_url: issue.html_url,
    issue_title: issue.title,
    issue_body: issue.body,
    issue_state: issue.state,
    labels: issue.labels.map(l => l.name),
    created_at: new Date(issue.created_at),
    updated_at: new Date(issue.updated_at),
    synced_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock BotState database record
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock database record
 */
export function mockDBBotState(overrides = {}) {
  return {
    id: faker.string.uuid(),
    chat_id: faker.number.int({ min: -999999999, max: -100000 }),
    state_key: overrides.state_key || 'last_message_processed',
    state_value: overrides.state_value || { timestamp: Date.now() },
    created_at: new Date(),
    updated_at: new Date(),
    expires_at: faker.date.future(),
    ...overrides,
  };
}

/**
 * Generate a mock MessageClassification database record
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock database record
 */
export function mockDBMessageClassification(overrides = {}) {
  const classifications = ['issue', 'bug', 'idea', 'question', 'ignore'];

  return {
    id: faker.string.uuid(),
    telegram_message_id: faker.string.uuid(),
    classification: faker.helpers.arrayElement(classifications),
    confidence: faker.number.float({ min: 0.6, max: 1.0, fractionDigits: 2 }),
    reasoning: faker.lorem.sentence(),
    labels: faker.helpers.arrayElements(['bug', 'enhancement', 'question'], { min: 0, max: 2 }),
    created_at: new Date(),
    ...overrides,
  };
}

/**
 * Generate a mock database query result
 * @param {Array} rows - Rows to return
 * @returns {object} Mock query result
 */
export function mockQueryResult(rows = []) {
  return {
    rows: rows,
    rowCount: rows.length,
    command: 'SELECT',
    oid: null,
    fields: [],
  };
}

/**
 * Generate a mock database insert result
 * @param {object} row - Inserted row
 * @returns {object} Mock insert result
 */
export function mockInsertResult(row) {
  return {
    rows: [row],
    rowCount: 1,
    command: 'INSERT',
    oid: null,
    fields: [],
  };
}

/**
 * Generate a mock database update result
 * @param {object} row - Updated row
 * @returns {object} Mock update result
 */
export function mockUpdateResult(row) {
  return {
    rows: [row],
    rowCount: 1,
    command: 'UPDATE',
    oid: null,
    fields: [],
  };
}

/**
 * Generate a mock database delete result
 * @param {number} count - Number of rows deleted
 * @returns {object} Mock delete result
 */
export function mockDeleteResult(count = 1) {
  return {
    rows: [],
    rowCount: count,
    command: 'DELETE',
    oid: null,
    fields: [],
  };
}
