/**
 * Unit tests for database repositories
 * Note: These tests require a running PostgreSQL database
 * Run with: npm test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, test } from 'vitest';
import { pool, testConnection, closePool } from '../../../src/database/db.js';
import { ConfigRepository } from '../../../src/database/repositories/config.js';
import { OperationsRepository } from '../../../src/database/repositories/operations.js';
import { FeedbackRepository } from '../../../src/database/repositories/feedback.js';
import { ConversationContextRepository } from '../../../src/database/repositories/context.js';
import { generateKey } from '../../../src/utils/encryption.js';
import { faker } from '@faker-js/faker';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check database availability at module load time
const DB_REQUIRED = process.env.RUN_DB_TESTS === 'true';

describe('Database Repositories', () => {
  const configRepo = new ConfigRepository();
  const operationsRepo = new OperationsRepository();
  const feedbackRepo = new FeedbackRepository();
  const contextRepo = new ConversationContextRepository();

  let dbAvailable = false;

  // Set up encryption key for tests
  beforeAll(async () => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = generateKey();
    }

    // Check database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.warn('⚠️  PostgreSQL is not available. Database repository tests will be skipped.');
      console.warn('   To run database tests, ensure PostgreSQL is running and set RUN_DB_TESTS=true');
      dbAvailable = false;
      return;
    }

    dbAvailable = true;

    // Load and run schema
    const schemaPath = path.join(__dirname, '../../../db/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    await pool.query(schema);
  });

  afterAll(async () => {
    if (dbAvailable) {
      await closePool();
    }
  });

  describe('ConfigRepository', () => {
    const testGroupId = faker.number.int({ min: -1000000000000, max: -1 });

    beforeEach(async () => {
      if (!dbAvailable) {
        // Skip all tests in this suite if database is not available
        throw new Error('Skipping: PostgreSQL is not available');
      }
      // Clean up test data
      await pool.query('DELETE FROM group_configs WHERE telegram_group_id = $1', [testGroupId]);
    });

    it('should create a new group configuration', async () => {
      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_testtoken123',
        managerUserId: faker.number.int({ min: 1000000, max: 9999999 }),
        settings: { notifications: true },
      };

      const result = await configRepo.setGroupConfig(testGroupId, config);

      expect(result).toBeDefined();
      expect(result.telegramGroupId).toBe(testGroupId);
      expect(result.githubRepo).toBe(config.githubRepo);
      expect(result.githubToken).toBe(config.githubToken);
      expect(result.managerUserId).toBe(config.managerUserId);
      expect(result.settings).toEqual(config.settings);
    });

    it('should retrieve existing group configuration', async () => {
      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_testtoken456',
        managerUserId: faker.number.int({ min: 1000000, max: 9999999 }),
      };

      await configRepo.setGroupConfig(testGroupId, config);
      const retrieved = await configRepo.getGroupConfig(testGroupId);

      expect(retrieved).toBeDefined();
      expect(retrieved.githubToken).toBe(config.githubToken);
    });

    it('should return null for non-existent group', async () => {
      const nonExistentId = faker.number.int({ min: -1000000000000, max: -1 });
      const result = await configRepo.getGroupConfig(nonExistentId);
      expect(result).toBeNull();
    });

    it('should update existing configuration', async () => {
      const initialConfig = {
        githubRepo: 'owner/repo1',
        githubToken: 'ghp_token1',
        managerUserId: 123456,
      };

      await configRepo.setGroupConfig(testGroupId, initialConfig);

      const updatedConfig = {
        githubRepo: 'owner/repo2',
        githubToken: 'ghp_token2',
        managerUserId: 789012,
      };

      const result = await configRepo.setGroupConfig(testGroupId, updatedConfig);

      expect(result.githubRepo).toBe(updatedConfig.githubRepo);
      expect(result.githubToken).toBe(updatedConfig.githubToken);
    });

    it('should update settings', async () => {
      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_token',
        managerUserId: 123456,
        settings: { notifications: true },
      };

      await configRepo.setGroupConfig(testGroupId, config);

      const newSettings = { autoClose: false };
      const result = await configRepo.updateSettings(testGroupId, newSettings);

      expect(result.settings.notifications).toBe(true);
      expect(result.settings.autoClose).toBe(false);
    });

    it('should delete group configuration', async () => {
      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_token',
        managerUserId: 123456,
      };

      await configRepo.setGroupConfig(testGroupId, config);
      const deleted = await configRepo.deleteGroupConfig(testGroupId);

      expect(deleted).toBe(true);

      const retrieved = await configRepo.getGroupConfig(testGroupId);
      expect(retrieved).toBeNull();
    });

    it('should check if config exists', async () => {
      const hasConfigBefore = await configRepo.hasConfig(testGroupId);
      expect(hasConfigBefore).toBe(false);

      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_token',
        managerUserId: 123456,
      };

      await configRepo.setGroupConfig(testGroupId, config);

      const hasConfigAfter = await configRepo.hasConfig(testGroupId);
      expect(hasConfigAfter).toBe(true);
    });

    it('should encrypt GitHub token', async () => {
      const config = {
        githubRepo: 'owner/repo',
        githubToken: 'ghp_plaintexttoken',
        managerUserId: 123456,
      };

      await configRepo.setGroupConfig(testGroupId, config);

      // Query raw database to check encryption
      const result = await pool.query(
        'SELECT encrypted_github_token FROM group_configs WHERE telegram_group_id = $1',
        [testGroupId]
      );

      const encryptedToken = result.rows[0].encrypted_github_token;

      // Encrypted token should not match plaintext
      expect(encryptedToken).not.toBe(config.githubToken);
      // Should be in format: iv:authTag:ciphertext
      expect(encryptedToken.split(':').length).toBe(3);
    });
  });

  describe('OperationsRepository', () => {
    let testGroupId;
    let testOperationId;

    beforeEach(async () => {
      if (!dbAvailable) {
        // Skip all tests in this suite if database is not available
        throw new Error('Skipping: PostgreSQL is not available');
      }
      testGroupId = faker.number.int({ min: -1000000000000, max: -1 });

      // Create a test group config first (foreign key constraint)
      await pool.query(
        `INSERT INTO group_configs (telegram_group_id, github_repo, encrypted_github_token, manager_user_id)
         VALUES ($1, $2, $3, $4)`,
        [testGroupId, 'owner/repo', 'encrypted_token', 123456]
      );

      // Clean up test operations
      await pool.query('DELETE FROM operations WHERE telegram_group_id = $1', [testGroupId]);
    });

    afterEach(async () => {
      await pool.query('DELETE FROM group_configs WHERE telegram_group_id = $1', [testGroupId]);
    });

    it('should create a new operation', async () => {
      const operationData = {
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_bug',
        githubIssueUrl: 'https://github.com/owner/repo/issues/1',
        operationData: { title: 'Test bug', labels: ['bug'] },
        status: 'completed',
      };

      const result = await operationsRepo.createOperation(operationData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.operationType).toBe(operationData.operationType);
      expect(result.status).toBe(operationData.status);

      testOperationId = result.id;
    });

    it('should update operation status', async () => {
      const operation = await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_task',
        status: 'pending',
      });

      const updated = await operationsRepo.updateOperationStatus(operation.id, 'completed');

      expect(updated.status).toBe('completed');
    });

    it('should update GitHub issue URL', async () => {
      const operation = await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_idea',
      });

      const issueUrl = 'https://github.com/owner/repo/issues/42';
      const updated = await operationsRepo.updateGithubIssueUrl(operation.id, issueUrl);

      expect(updated.githubIssueUrl).toBe(issueUrl);
    });

    it('should retrieve operation by ID', async () => {
      const operation = await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_bug',
      });

      const retrieved = await operationsRepo.getOperationById(operation.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(operation.id);
    });

    it('should retrieve operation by message ID', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });

      const operation = await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: messageId,
        operationType: 'create_task',
      });

      const retrieved = await operationsRepo.getOperationByMessageId(messageId);

      expect(retrieved).toBeDefined();
      expect(retrieved.telegramMessageId).toBe(messageId);
    });

    it('should get group operation history', async () => {
      // Create multiple operations
      for (let i = 0; i < 3; i++) {
        await operationsRepo.createOperation({
          telegramGroupId: testGroupId,
          telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
          operationType: 'create_bug',
        });
      }

      const history = await operationsRepo.getGroupOperationHistory(testGroupId);

      expect(history).toBeDefined();
      expect(history.length).toBe(3);
    });

    it('should get operations by status', async () => {
      await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_bug',
        status: 'completed',
      });

      await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_task',
        status: 'failed',
      });

      const completedOps = await operationsRepo.getOperationsByStatus('completed');

      expect(completedOps.length).toBeGreaterThan(0);
      expect(completedOps.every(op => op.status === 'completed')).toBe(true);
    });

    it('should delete operation', async () => {
      const operation = await operationsRepo.createOperation({
        telegramGroupId: testGroupId,
        telegramMessageId: faker.number.int({ min: 1, max: 999999 }),
        operationType: 'create_bug',
      });

      const deleted = await operationsRepo.deleteOperation(operation.id);
      expect(deleted).toBe(true);

      const retrieved = await operationsRepo.getOperationById(operation.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('FeedbackRepository', () => {
    let testGroupId;
    let testOperationId;

    beforeEach(async () => {
      if (!dbAvailable) {
        // Skip all tests in this suite if database is not available
        throw new Error('Skipping: PostgreSQL is not available');
      }
      testGroupId = faker.number.int({ min: -1000000000000, max: -1 });

      // Create test group and operation
      await pool.query(
        `INSERT INTO group_configs (telegram_group_id, github_repo, encrypted_github_token, manager_user_id)
         VALUES ($1, $2, $3, $4)`,
        [testGroupId, 'owner/repo', 'encrypted_token', 123456]
      );

      const opResult = await pool.query(
        `INSERT INTO operations (telegram_group_id, telegram_message_id, operation_type)
         VALUES ($1, $2, $3) RETURNING id`,
        [testGroupId, faker.number.int({ min: 1, max: 999999 }), 'create_bug']
      );

      testOperationId = opResult.rows[0].id;
    });

    afterEach(async () => {
      await pool.query('DELETE FROM group_configs WHERE telegram_group_id = $1', [testGroupId]);
    });

    it('should create feedback message', async () => {
      const feedbackData = {
        operationId: testOperationId,
        feedbackMessageId: faker.number.int({ min: 1, max: 999999 }),
        scheduledDeletion: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };

      const result = await feedbackRepo.createFeedback(feedbackData);

      expect(result).toBeDefined();
      expect(result.operationId).toBe(testOperationId);
      expect(result.dismissed).toBe(false);
    });

    it('should retrieve feedback by message ID', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: new Date(Date.now() + 10 * 60 * 1000),
      });

      const retrieved = await feedbackRepo.getFeedbackByMessageId(messageId);

      expect(retrieved).toBeDefined();
      expect(retrieved.feedbackMessageId).toBe(messageId);
    });

    it('should retrieve feedback by operation ID', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: new Date(Date.now() + 10 * 60 * 1000),
      });

      const retrieved = await feedbackRepo.getFeedbackByOperationId(testOperationId);

      expect(retrieved).toBeDefined();
      expect(retrieved.operationId).toBe(testOperationId);
    });

    it('should mark feedback as dismissed', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: new Date(Date.now() + 10 * 60 * 1000),
      });

      const result = await feedbackRepo.markDismissed(messageId);

      expect(result.dismissed).toBe(true);
    });

    it('should get scheduled deletions', async () => {
      // Create feedback scheduled for deletion in the past
      const pastTime = new Date(Date.now() - 1000); // 1 second ago

      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: pastTime,
      });

      const scheduled = await feedbackRepo.getScheduledDeletions();

      expect(scheduled.length).toBeGreaterThan(0);
      expect(scheduled.some(f => f.feedbackMessageId === messageId)).toBe(true);
    });

    it('should not include dismissed feedback in scheduled deletions', async () => {
      const pastTime = new Date(Date.now() - 1000);
      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: pastTime,
      });

      await feedbackRepo.markDismissed(messageId);

      const scheduled = await feedbackRepo.getScheduledDeletions();

      expect(scheduled.some(f => f.feedbackMessageId === messageId)).toBe(false);
    });

    it('should delete feedback', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: new Date(Date.now() + 10 * 60 * 1000),
      });

      const deleted = await feedbackRepo.deleteFeedback(messageId);
      expect(deleted).toBe(true);

      const retrieved = await feedbackRepo.getFeedbackByMessageId(messageId);
      expect(retrieved).toBeNull();
    });

    it('should update scheduled deletion time', async () => {
      const messageId = faker.number.int({ min: 1, max: 999999 });
      const initialTime = new Date(Date.now() + 10 * 60 * 1000);

      await feedbackRepo.createFeedback({
        operationId: testOperationId,
        feedbackMessageId: messageId,
        scheduledDeletion: initialTime,
      });

      const newTime = new Date(Date.now() + 20 * 60 * 1000);
      const updated = await feedbackRepo.updateScheduledDeletion(messageId, newTime);

      expect(new Date(updated.scheduledDeletion).getTime()).toBe(newTime.getTime());
    });
  });

  describe('ConversationContextRepository', () => {
    const testGroupId = faker.number.int({ min: -1000000000000, max: -1 });
    const testThreadId = faker.number.int({ min: 1, max: 999999 });

    beforeEach(async () => {
      if (!dbAvailable) {
        // Skip all tests in this suite if database is not available
        throw new Error('Skipping: PostgreSQL is not available');
      }
      await pool.query(
        'DELETE FROM conversation_context WHERE telegram_group_id = $1',
        [testGroupId]
      );
    });

    it('should cache conversation context', async () => {
      const contextData = {
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [
          { id: 1, text: 'First message' },
          { id: 2, text: 'Second message' },
        ],
        ttlMinutes: 60,
      };

      const result = await contextRepo.cacheContext(contextData);

      expect(result).toBeDefined();
      expect(result.telegramGroupId).toBe(testGroupId);
      expect(result.messagesChain).toEqual(contextData.messagesChain);
    });

    it('should retrieve cached context', async () => {
      const messagesChain = [{ id: 1, text: 'Test message' }];

      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain,
        ttlMinutes: 60,
      });

      const retrieved = await contextRepo.getContext(testGroupId, testThreadId);

      expect(retrieved).toBeDefined();
      expect(retrieved.messagesChain).toEqual(messagesChain);
    });

    it('should return null for expired context', async () => {
      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Test' }],
        ttlMinutes: 0, // Already expired
      });

      // Wait a moment for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const retrieved = await contextRepo.getContext(testGroupId, testThreadId);

      expect(retrieved).toBeNull();
    });

    it('should check if valid context exists', async () => {
      const hasBefore = await contextRepo.hasValidContext(testGroupId, testThreadId);
      expect(hasBefore).toBe(false);

      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Test' }],
        ttlMinutes: 60,
      });

      const hasAfter = await contextRepo.hasValidContext(testGroupId, testThreadId);
      expect(hasAfter).toBe(true);
    });

    it('should invalidate expired contexts', async () => {
      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Test' }],
        ttlMinutes: 0, // Already expired
      });

      const deleted = await contextRepo.invalidateExpiredContexts();

      expect(deleted).toBeGreaterThan(0);
    });

    it('should delete specific context', async () => {
      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Test' }],
        ttlMinutes: 60,
      });

      const deleted = await contextRepo.deleteContext(testGroupId, testThreadId);
      expect(deleted).toBe(true);

      const retrieved = await contextRepo.getContext(testGroupId, testThreadId);
      expect(retrieved).toBeNull();
    });

    it('should update context TTL', async () => {
      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Test' }],
        ttlMinutes: 10,
      });

      const updated = await contextRepo.updateTTL(testGroupId, testThreadId, 120);

      expect(updated).toBeDefined();
      // Check that expires_at is approximately 120 minutes from now
      const expiresAt = new Date(updated.expiresAt);
      const expectedTime = new Date(Date.now() + 120 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedTime.getTime());
      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });

    it('should get cache statistics', async () => {
      // Create some test contexts
      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: [{ id: 1, text: 'Valid' }],
        ttlMinutes: 60,
      });

      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId + 1,
        messagesChain: [{ id: 2, text: 'Expired' }],
        ttlMinutes: 0,
      });

      const stats = await contextRepo.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.valid).toBeGreaterThan(0);
      expect(stats.expired).toBeGreaterThan(0);
    });

    it('should upsert context on conflict', async () => {
      const initialMessages = [{ id: 1, text: 'Initial' }];
      const updatedMessages = [{ id: 1, text: 'Updated' }];

      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: initialMessages,
        ttlMinutes: 60,
      });

      await contextRepo.cacheContext({
        telegramGroupId: testGroupId,
        threadRootMessageId: testThreadId,
        messagesChain: updatedMessages,
        ttlMinutes: 60,
      });

      const retrieved = await contextRepo.getContext(testGroupId, testThreadId);

      expect(retrieved.messagesChain).toEqual(updatedMessages);
    });
  });
});
