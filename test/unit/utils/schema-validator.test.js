/**
 * Unit Tests for Schema Validation Module
 *
 * Tests schema validation functionality including:
 * - Intent classification validation
 * - GitHub operation parameter validation
 * - Telegram message validation
 * - Configuration validation
 * - Custom validator creation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateIntent,
  validateGitHubIssue,
  validateGitHubIssueUpdate,
  validateGitHubSearch,
  validateTelegramMessage,
  validateBotConfig,
  createValidator,
  safeParse,
  IntentSchema,
  INTENT_TYPES
} from '../../../src/utils/schema-validator.js';

describe('schema-validator', () => {
  describe('validateIntent', () => {
    it('should validate correct intent with all fields', () => {
      const input = {
        intent: 'create_bug',
        confidence: 0.95,
        entities: {
          title: 'Fix login bug',
          description: 'Users cannot log in',
          labels: ['bug', 'urgent'],
          assignees: ['developer1']
        }
      };

      const result = validateIntent(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
      expect(result.errors).toBeUndefined();
    });

    it('should validate intent with minimal fields', () => {
      const input = {
        intent: 'unknown',
        confidence: 0.3
      };

      const result = validateIntent(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate all intent types', () => {
      const intentTypes = ['create_bug', 'create_task', 'create_idea', 'update_issue', 'search_issues', 'unknown'];

      intentTypes.forEach(intent => {
        const result = validateIntent({ intent, confidence: 0.8 });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid intent type', () => {
      const input = {
        intent: 'invalid_intent',
        confidence: 0.9
      };

      const result = validateIntent(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject confidence out of range', () => {
      const tooHigh = { intent: 'create_bug', confidence: 1.5 };
      const tooLow = { intent: 'create_bug', confidence: -0.1 };

      expect(validateIntent(tooHigh).valid).toBe(false);
      expect(validateIntent(tooLow).valid).toBe(false);
    });

    it('should reject missing required fields', () => {
      const noIntent = { confidence: 0.9 };
      const noConfidence = { intent: 'create_bug' };

      expect(validateIntent(noIntent).valid).toBe(false);
      expect(validateIntent(noConfidence).valid).toBe(false);
    });

    it('should accept empty entities object', () => {
      const input = {
        intent: 'create_bug',
        confidence: 0.9,
        entities: {}
      };

      const result = validateIntent(input);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateGitHubIssue', () => {
    it('should validate correct GitHub issue parameters', () => {
      const input = {
        repository: 'owner/repo',
        title: 'Bug report',
        body: 'Description of the bug',
        labels: ['bug', 'urgent'],
        assignees: ['user1', 'user2']
      };

      const result = validateGitHubIssue(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate issue with minimal fields', () => {
      const input = {
        repository: 'owner/repo',
        title: 'Title',
        body: 'Body'
      };

      const result = validateGitHubIssue(input);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid repository format', () => {
      const invalid = [
        { repository: 'invalid', title: 'T', body: 'B' },
        { repository: 'owner/', title: 'T', body: 'B' },
        { repository: '/repo', title: 'T', body: 'B' },
        { repository: 'owner/repo/extra', title: 'T', body: 'B' }
      ];

      invalid.forEach(input => {
        const result = validateGitHubIssue(input);
        expect(result.valid).toBe(false);
      });
    });

    it('should reject empty title', () => {
      const input = {
        repository: 'owner/repo',
        title: '',
        body: 'Body'
      };

      const result = validateGitHubIssue(input);
      expect(result.valid).toBe(false);
    });

    it('should reject title exceeding maximum length', () => {
      const input = {
        repository: 'owner/repo',
        title: 'x'.repeat(257),
        body: 'Body'
      };

      const result = validateGitHubIssue(input);
      expect(result.valid).toBe(false);
    });

    it('should reject body exceeding maximum length', () => {
      const input = {
        repository: 'owner/repo',
        title: 'Title',
        body: 'x'.repeat(65537)
      };

      const result = validateGitHubIssue(input);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateGitHubIssueUpdate', () => {
    it('should validate correct update parameters', () => {
      const input = {
        repository: 'owner/repo',
        issueNumber: 42,
        title: 'Updated title',
        state: 'closed'
      };

      const result = validateGitHubIssueUpdate(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate with minimal fields', () => {
      const input = {
        repository: 'owner/repo',
        issueNumber: 1
      };

      const result = validateGitHubIssueUpdate(input);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid issue number', () => {
      const invalid = [
        { repository: 'owner/repo', issueNumber: 0 },
        { repository: 'owner/repo', issueNumber: -1 },
        { repository: 'owner/repo', issueNumber: 1.5 }
      ];

      invalid.forEach(input => {
        const result = validateGitHubIssueUpdate(input);
        expect(result.valid).toBe(false);
      });
    });

    it('should reject invalid state', () => {
      const input = {
        repository: 'owner/repo',
        issueNumber: 1,
        state: 'invalid_state'
      };

      const result = validateGitHubIssueUpdate(input);
      expect(result.valid).toBe(false);
    });

    it('should accept valid states', () => {
      ['open', 'closed'].forEach(state => {
        const input = {
          repository: 'owner/repo',
          issueNumber: 1,
          state
        };

        const result = validateGitHubIssueUpdate(input);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateGitHubSearch', () => {
    it('should validate correct search parameters', () => {
      const input = {
        repository: 'owner/repo',
        query: 'bug',
        state: 'open',
        labels: ['bug', 'urgent'],
        limit: 10
      };

      const result = validateGitHubSearch(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate with minimal fields', () => {
      const input = {
        repository: 'owner/repo',
        query: 'search term'
      };

      const result = validateGitHubSearch(input);
      expect(result.valid).toBe(true);
    });

    it('should reject empty query', () => {
      const input = {
        repository: 'owner/repo',
        query: ''
      };

      const result = validateGitHubSearch(input);
      expect(result.valid).toBe(false);
    });

    it('should reject limit exceeding maximum', () => {
      const input = {
        repository: 'owner/repo',
        query: 'bug',
        limit: 101
      };

      const result = validateGitHubSearch(input);
      expect(result.valid).toBe(false);
    });

    it('should accept valid states', () => {
      ['open', 'closed', 'all'].forEach(state => {
        const input = {
          repository: 'owner/repo',
          query: 'bug',
          state
        };

        const result = validateGitHubSearch(input);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('validateTelegramMessage', () => {
    it('should validate correct Telegram message', () => {
      const input = {
        messageId: 123,
        chatId: -456,
        userId: 789,
        text: 'Hello world',
        replyToMessageId: 100,
        hasImage: true,
        timestamp: Date.now()
      };

      const result = validateTelegramMessage(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate with minimal fields', () => {
      const input = {
        messageId: 1,
        chatId: -1,
        userId: 1,
        text: 'Hi',
        timestamp: 1000000
      };

      const result = validateTelegramMessage(input);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid message ID', () => {
      const input = {
        messageId: -1,
        chatId: -1,
        userId: 1,
        text: 'Hi',
        timestamp: 1000
      };

      const result = validateTelegramMessage(input);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid user ID', () => {
      const input = {
        messageId: 1,
        chatId: -1,
        userId: 0,
        text: 'Hi',
        timestamp: 1000
      };

      const result = validateTelegramMessage(input);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateBotConfig', () => {
    it('should validate correct bot configuration', () => {
      const input = {
        telegramBotToken: 'bot123456:ABC-DEF',
        encryptionKey: 'a'.repeat(64),
        databaseUrl: 'postgresql://localhost/db',
        allowedGroups: [-123, -456],
        allowedUsers: [789, 101112],
        llmModel: 'gpt-4',
        llmApiKey: 'sk-...'
      };

      const result = validateBotConfig(input);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(input);
    });

    it('should validate with minimal fields', () => {
      const input = {
        telegramBotToken: 'token',
        encryptionKey: '0123456789abcdef'.repeat(4),
        databaseUrl: 'postgresql://localhost/db'
      };

      const result = validateBotConfig(input);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid encryption key length', () => {
      const input = {
        telegramBotToken: 'token',
        encryptionKey: 'tooshort',
        databaseUrl: 'postgresql://localhost/db'
      };

      const result = validateBotConfig(input);
      expect(result.valid).toBe(false);
    });

    it('should reject non-hex encryption key', () => {
      const input = {
        telegramBotToken: 'token',
        encryptionKey: 'g'.repeat(64),
        databaseUrl: 'postgresql://localhost/db'
      };

      const result = validateBotConfig(input);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid database URL', () => {
      const input = {
        telegramBotToken: 'token',
        encryptionKey: 'a'.repeat(64),
        databaseUrl: 'not-a-url'
      };

      const result = validateBotConfig(input);
      expect(result.valid).toBe(false);
    });
  });

  describe('createValidator', () => {
    it('should create a custom validator', () => {
      const CustomSchema = z.object({
        name: z.string(),
        age: z.number().positive()
      });

      const validate = createValidator(CustomSchema);

      const valid = validate({ name: 'John', age: 30 });
      expect(valid.valid).toBe(true);
      expect(valid.data).toEqual({ name: 'John', age: 30 });

      const invalid = validate({ name: 'John', age: -5 });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toBeDefined();
    });

    it('should handle complex nested schemas', () => {
      const NestedSchema = z.object({
        user: z.object({
          name: z.string(),
          email: z.string().email()
        }),
        items: z.array(z.number())
      });

      const validate = createValidator(NestedSchema);

      const valid = validate({
        user: { name: 'John', email: 'john@example.com' },
        items: [1, 2, 3]
      });
      expect(valid.valid).toBe(true);

      const invalid = validate({
        user: { name: 'John', email: 'invalid-email' },
        items: [1, 2, 3]
      });
      expect(invalid.valid).toBe(false);
    });
  });

  describe('safeParse', () => {
    it('should return validated data on success', () => {
      const result = safeParse(IntentSchema, {
        intent: 'create_bug',
        confidence: 0.9
      });

      expect(result).not.toBeNull();
      expect(result.intent).toBe('create_bug');
      expect(result.confidence).toBe(0.9);
    });

    it('should return null on validation failure', () => {
      const result = safeParse(IntentSchema, {
        intent: 'invalid',
        confidence: 'not-a-number'
      });

      expect(result).toBeNull();
    });

    it('should work with custom schemas', () => {
      const CustomSchema = z.object({
        id: z.number(),
        name: z.string()
      });

      const valid = safeParse(CustomSchema, { id: 1, name: 'Test' });
      expect(valid).toEqual({ id: 1, name: 'Test' });

      const invalid = safeParse(CustomSchema, { id: 'not-a-number', name: 'Test' });
      expect(invalid).toBeNull();
    });
  });

  describe('INTENT_TYPES', () => {
    it('should export all intent types', () => {
      expect(INTENT_TYPES).toContain('create_bug');
      expect(INTENT_TYPES).toContain('create_task');
      expect(INTENT_TYPES).toContain('create_idea');
      expect(INTENT_TYPES).toContain('update_issue');
      expect(INTENT_TYPES).toContain('search_issues');
      expect(INTENT_TYPES).toContain('unknown');
      expect(INTENT_TYPES.length).toBe(6);
    });
  });

  describe('error handling', () => {
    it('should provide helpful error messages', () => {
      const result = validateIntent({
        intent: 'create_bug',
        confidence: 'invalid'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const result = validateGitHubIssue({
        repository: 'invalid',
        title: '',
        body: 123
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should include field path in error messages', () => {
      const result = validateIntent({
        intent: 'create_bug',
        confidence: 0.9,
        entities: {
          labels: 'not-an-array'
        }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('entities.labels'))).toBe(true);
    });
  });
});
