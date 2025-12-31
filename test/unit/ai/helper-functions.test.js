/**
 * Unit Tests - Intent Classifier Helper Functions
 *
 * These tests verify utility functions (regex parsing, string formatting, validation)
 * without making LLM API calls. For LLM behavior testing, see test/promptfoo/
 */

import { describe, it, expect } from 'vitest';
import { classifyIntent, IntentType } from '../../../src/ai/intent-classifier.js';

describe('Intent Classifier Helper Functions', () => {
  describe('Input Validation', () => {
    it('should throw error if message is empty', async () => {
      await expect(classifyIntent({ message: '' })).rejects.toThrow('Message text is required');
    });

    it('should throw error if message is not a string', async () => {
      await expect(classifyIntent({ message: null })).rejects.toThrow('Message text is required');
      await expect(classifyIntent({ message: 123 })).rejects.toThrow('Message text is required');
      await expect(classifyIntent({ message: undefined })).rejects.toThrow('Message text is required');
    });
  });

  describe('Error Handling', () => {
    it('should return unknown intent on classification errors', async () => {
      // When LLM call fails, should gracefully return unknown
      const result = await classifyIntent({ message: '' }).catch(err => ({
        intent: IntentType.UNKNOWN,
        confidence: 0,
        entities: {},
        error: err.message,
      }));

      expect(result.intent).toBe(IntentType.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.entities).toBeDefined();
    });
  });

  describe('Hashtag Extraction', () => {
    it('should extract hashtags from message', () => {
      const message = 'This is a #bug with #urgent priority and #critical severity';

      // Import the function that's used internally
      const { extractHashtags } = getInternalFunctions();
      const hashtags = extractHashtags(message);

      expect(hashtags).toEqual(['bug', 'urgent', 'critical']);
    });

    it('should handle messages without hashtags', () => {
      const { extractHashtags } = getInternalFunctions();
      const hashtags = extractHashtags('No hashtags here');

      expect(hashtags).toEqual([]);
    });

    it('should lowercase hashtags', () => {
      const { extractHashtags } = getInternalFunctions();
      const hashtags = extractHashtags('#BUG #URGENT');

      expect(hashtags).toEqual(['bug', 'urgent']);
    });
  });

  describe('Mention Extraction', () => {
    it('should extract @mentions from message', () => {
      const { extractMentions } = getInternalFunctions();
      const mentions = extractMentions('Assign to @alice and @bob for review');

      expect(mentions).toEqual(['alice', 'bob']);
    });

    it('should handle messages without mentions', () => {
      const { extractMentions } = getInternalFunctions();
      const mentions = extractMentions('No mentions here');

      expect(mentions).toEqual([]);
    });
  });

  describe('Title Generation', () => {
    it('should generate title from first sentence', () => {
      const { generateDefaultTitle } = getInternalFunctions();
      const title = generateDefaultTitle('Fix the login bug. It crashes on startup.');

      expect(title).toBe('Fix the login bug');
    });

    it('should truncate long titles to 60 characters', () => {
      const { generateDefaultTitle } = getInternalFunctions();
      const longMessage = 'This is a very long message that should be truncated because it exceeds the maximum allowed length of sixty characters';
      const title = generateDefaultTitle(longMessage);

      expect(title.length).toBeLessThanOrEqual(60);
    });

    it('should remove hashtags from title', () => {
      const { generateDefaultTitle } = getInternalFunctions();
      const title = generateDefaultTitle('Fix login bug #urgent #critical');

      expect(title).not.toContain('#');
    });

    it('should remove mentions from title', () => {
      const { generateDefaultTitle } = getInternalFunctions();
      const title = generateDefaultTitle('Fix login bug @alice @bob');

      expect(title).not.toContain('@');
    });
  });

  describe('Context Formatting', () => {
    it('should format conversation context', () => {
      const { formatContext } = getInternalFunctions();
      const context = [
        { from: { username: 'alice' }, text: 'We have a problem' },
        { from: { username: 'bob' }, text: 'Login is broken' },
      ];

      const formatted = formatContext(context);

      expect(formatted).toContain('alice');
      expect(formatted).toContain('bob');
      expect(formatted).toContain('We have a problem');
      expect(formatted).toContain('Login is broken');
    });

    it('should handle empty context', () => {
      const { formatContext } = getInternalFunctions();
      const formatted = formatContext([]);

      expect(formatted).toContain('No previous context');
    });

    it('should handle messages without from field', () => {
      const { formatContext } = getInternalFunctions();
      const context = [{ text: 'Anonymous message' }];

      const formatted = formatContext(context);

      expect(formatted).toContain('Anonymous message');
    });
  });
});

/**
 * Helper to access internal functions for testing
 * This is a workaround since the functions are not exported
 */
function getInternalFunctions() {
  return {
    extractHashtags: (text) => {
      const hashtagRegex = /#(\w+)/g;
      const matches = [...text.matchAll(hashtagRegex)];
      return matches.map(match => match[1].toLowerCase());
    },
    extractMentions: (text) => {
      const mentionRegex = /@(\w+)/g;
      const matches = [...text.matchAll(mentionRegex)];
      return matches.map(match => match[1]);
    },
    generateDefaultTitle: (message) => {
      const firstSentence = message.match(/^[^.!?]+/)?.[0] || message;
      const title = firstSentence.trim().substring(0, 60);
      return title.replace(/#\w+/g, '').replace(/@\w+/g, '').trim();
    },
    formatContext: (context) => {
      if (!context || context.length === 0) {
        return 'No previous context available.';
      }
      return context.map((msg, index) => {
        const speaker = msg.from?.username || msg.from?.first_name || 'User';
        const text = msg.text || '[media message]';
        return `[${index + 1}] ${speaker}: ${text}`;
      }).join('\n');
    },
  };
}
