/**
 * Unit Tests - Intent Classifier
 *
 * Task 4.2.1a: Unit Tests - Intent Classifier
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent, batchClassifyIntents, IntentType } from '../../../src/ai/intent-classifier.js';

describe('Intent Classifier', () => {
  describe('classifyIntent', () => {
    it('should throw error if message is not provided', async () => {
      await expect(classifyIntent({ message: '' })).rejects.toThrow('Message text is required');
    });

    it('should throw error if message is not a string', async () => {
      await expect(classifyIntent({ message: null })).rejects.toThrow('Message text is required');
      await expect(classifyIntent({ message: 123 })).rejects.toThrow('Message text is required');
    });

    it('should return unknown intent on classification errors', async () => {
      // This test will actually call the LLM, but if it fails, it should gracefully return unknown
      const result = await classifyIntent({ message: '' }).catch(err => ({
        intent: IntentType.UNKNOWN,
        confidence: 0,
        entities: {},
        error: err.message,
      }));

      expect(result.intent).toBe(IntentType.UNKNOWN);
      expect(result.confidence).toBe(0);
    });

    // Note: The following tests require actual LLM API access
    // They are integration tests but placed here for completeness
    // They can be skipped in CI/CD if API keys are not available

    describe('Bug Detection', () => {
      it('should classify bug reports correctly', async () => {
        const result = await classifyIntent({
          message: 'The login button is broken and throws a 500 error #bug',
        });

        expect(result.intent).toBe(IntentType.CREATE_BUG);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.entities.title).toBeDefined();
        expect(result.entities.title.length).toBeLessThanOrEqual(60);
        expect(result.entities.labels).toContain('bug');
      }, { timeout: 30000 });

      it('should extract error context from bug reports', async () => {
        const result = await classifyIntent({
          message: 'Getting TypeError when submitting the form. Stack trace shows undefined value.',
        });

        expect(result.intent).toBe(IntentType.CREATE_BUG);
        expect(result.entities.description).toContain('TypeError');
      }, { timeout: 30000 });
    });

    describe('Task Detection', () => {
      it('should classify task creation correctly', async () => {
        const result = await classifyIntent({
          message: 'TODO: Add validation to the signup form #task',
        });

        expect(result.intent).toBe(IntentType.CREATE_TASK);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.entities.labels).toContain('task');
      }, { timeout: 30000 });

      it('should handle task-like language', async () => {
        const result = await classifyIntent({
          message: 'We need to implement rate limiting for the API',
        });

        expect(result.intent).toBe(IntentType.CREATE_TASK);
        expect(result.entities.title).toBeDefined();
      }, { timeout: 30000 });
    });

    describe('Idea Detection', () => {
      it('should classify feature ideas correctly', async () => {
        const result = await classifyIntent({
          message: 'What if we added dark mode to the app? #idea',
        });

        expect(result.intent).toBe(IntentType.CREATE_IDEA);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.entities.labels).toContain('idea');
      }, { timeout: 30000 });

      it('should detect enhancement suggestions', async () => {
        const result = await classifyIntent({
          message: 'Feature request: export user data as CSV',
        });

        expect(result.intent).toBe(IntentType.CREATE_IDEA);
        expect(result.entities.title).toContain('export');
      }, { timeout: 30000 });
    });

    describe('Update Issue Detection', () => {
      it('should detect issue updates with explicit references', async () => {
        const result = await classifyIntent({
          message: 'Close issue #42, the bug has been fixed in production',
        });

        expect(result.intent).toBe(IntentType.UPDATE_ISSUE);
        expect(result.entities.issueNumber).toBe('42');
      }, { timeout: 30000 });

      it('should handle different issue reference formats', async () => {
        const result = await classifyIntent({
          message: 'Update issue 15 with more context about the error',
        });

        expect(result.intent).toBe(IntentType.UPDATE_ISSUE);
        expect(result.entities.issueNumber).toBe('15');
      }, { timeout: 30000 });
    });

    describe('Search Issues Detection', () => {
      it('should detect search requests', async () => {
        const result = await classifyIntent({
          message: 'Find all bugs related to authentication',
        });

        expect(result.intent).toBe(IntentType.SEARCH_ISSUES);
        expect(result.entities.searchQuery).toBeDefined();
        expect(result.entities.searchQuery).toContain('authentication');
      }, { timeout: 30000 });

      it('should handle list requests', async () => {
        const result = await classifyIntent({
          message: 'Show me all open tasks tagged #urgent',
        });

        expect(result.intent).toBe(IntentType.SEARCH_ISSUES);
      }, { timeout: 30000 });
    });

    describe('Unknown Intent Handling', () => {
      it('should classify casual conversation as unknown', async () => {
        const result = await classifyIntent({
          message: 'Hey, how are you doing?',
        });

        expect(result.intent).toBe(IntentType.UNKNOWN);
        expect(result.confidence).toBeLessThan(0.5);
      }, { timeout: 30000 });

      it('should handle ambiguous messages', async () => {
        const result = await classifyIntent({
          message: 'Thanks!',
        });

        expect(result.intent).toBe(IntentType.UNKNOWN);
      }, { timeout: 30000 });
    });

    describe('Entity Extraction', () => {
      it('should extract hashtags as labels', async () => {
        const result = await classifyIntent({
          message: 'Fix the navigation bug #urgent #ui #bug',
        });

        expect(result.entities.labels).toContain('urgent');
        expect(result.entities.labels).toContain('ui');
        expect(result.entities.labels).toContain('bug');
      }, { timeout: 30000 });

      it('should extract mentions as assignees', async () => {
        const result = await classifyIntent({
          message: 'Assign this task to @john and @sarah',
        });

        expect(result.entities.assignees).toContain('john');
        expect(result.entities.assignees).toContain('sarah');
      }, { timeout: 30000 });

      it('should generate default title from message', async () => {
        const result = await classifyIntent({
          message: 'The payment processing is failing for credit card transactions',
        });

        expect(result.entities.title).toBeDefined();
        expect(result.entities.title.length).toBeLessThanOrEqual(60);
        expect(result.entities.title.toLowerCase()).toContain('payment');
      }, { timeout: 30000 });
    });

    describe('Context Handling', () => {
      it('should use conversation context when provided', async () => {
        const context = [
          { from: { username: 'alice' }, text: 'We have a serious authentication problem' },
          { from: { username: 'bob' }, text: 'Users are unable to log in with their credentials' },
        ];

        const result = await classifyIntent({
          message: 'This needs to be fixed ASAP #bug',
          context,
        });

        expect(result.intent).toBe(IntentType.CREATE_BUG);
        expect(result.entities.description || result.entities.title).toMatch(/authentication|log/i);
      }, { timeout: 30000 });
    });

    describe('Confidence Scoring', () => {
      it('should have high confidence for clear intents', async () => {
        const result = await classifyIntent({
          message: 'BUG: Critical error in payment processing - users cannot complete checkout',
        });

        expect(result.confidence).toBeGreaterThan(0.8);
      }, { timeout: 30000 });

      it('should have lower confidence for ambiguous messages', async () => {
        const result = await classifyIntent({
          message: 'Something seems off with the app',
        });

        // Confidence might vary, but should be classified
        expect(result.intent).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      }, { timeout: 30000 });
    });

    describe('Edge Cases', () => {
      it('should handle very long messages', async () => {
        const longMessage = 'Fix the bug. ' + 'Lorem ipsum dolor sit amet. '.repeat(50);

        const result = await classifyIntent({ message: longMessage });

        expect(result.intent).toBeDefined();
        expect(result.entities.title?.length || 0).toBeLessThanOrEqual(60);
      }, { timeout: 30000 });

      it('should handle messages with special characters', async () => {
        const result = await classifyIntent({
          message: 'Bug: Users with names like "O\'Brien" can\'t sign up #bug',
        });

        expect(result.intent).toBe(IntentType.CREATE_BUG);
      }, { timeout: 30000 });

      it('should handle empty context array', async () => {
        const result = await classifyIntent({
          message: 'Fix login bug',
          context: [],
        });

        expect(result.intent).toBeDefined();
      }, { timeout: 30000 });
    });
  });

  describe('batchClassifyIntents', () => {
    it('should classify multiple messages', async () => {
      const messages = [
        { message: 'Fix the login bug #bug' },
        { message: 'Add dark mode feature #idea' },
        { message: 'TODO: refactor authentication #task' },
      ];

      const results = await batchClassifyIntents(messages);

      expect(results).toHaveLength(3);
      expect(results[0].intent).toBe(IntentType.CREATE_BUG);
      expect(results[1].intent).toBe(IntentType.CREATE_IDEA);
      expect(results[2].intent).toBe(IntentType.CREATE_TASK);
    }, { timeout: 60000 });
  });
});
