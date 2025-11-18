/**
 * Unit tests for mock data generators
 */

import { describe, it, expect } from 'vitest';
import {
  mockTelegramUser,
  mockTelegramMessage,
  mockTelegramMessageByType,
  mockGitHubIssue,
  mockGitHubLabel,
  mockClassification,
  mockDBTelegramMessage,
} from '../mocks/index.js';

describe('Mock Data Generators', () => {
  describe('Telegram Mocks', () => {
    it('should generate a valid Telegram user', () => {
      const user = mockTelegramUser();

      expect(user).toBeDefined();
      expect(user.id).toBeTypeOf('number');
      expect(user.first_name).toBeTypeOf('string');
      expect(user.username).toBeTypeOf('string');
    });

    it('should generate a valid Telegram message', () => {
      const message = mockTelegramMessage();

      expect(message).toBeDefined();
      expect(message.message_id).toBeTypeOf('number');
      expect(message.from).toBeDefined();
      expect(message.chat).toBeDefined();
      expect(message.text).toBeTypeOf('string');
    });

    it('should generate messages by type', () => {
      const types = ['bug', 'issue', 'idea', 'question', 'ignore'];

      for (const type of types) {
        const message = mockTelegramMessageByType(type);
        expect(message).toBeDefined();
        expect(message.text).toBeTypeOf('string');
        expect(message.text.length).toBeGreaterThan(0);
      }
    });

    it('should allow overriding fields', () => {
      const customText = 'Custom message text';
      const message = mockTelegramMessage({ text: customText });

      expect(message.text).toBe(customText);
    });
  });

  describe('GitHub Mocks', () => {
    it('should generate a valid GitHub issue', () => {
      const issue = mockGitHubIssue();

      expect(issue).toBeDefined();
      expect(issue.number).toBeTypeOf('number');
      expect(issue.title).toBeTypeOf('string');
      expect(issue.body).toBeTypeOf('string');
      expect(issue.state).toMatch(/^(open|closed)$/);
      expect(issue.html_url).toContain('github.com');
    });

    it('should generate a valid GitHub label', () => {
      const label = mockGitHubLabel();

      expect(label).toBeDefined();
      expect(label.name).toBeTypeOf('string');
      expect(label.color).toBeTypeOf('string');
    });
  });

  describe('LLM Mocks', () => {
    it('should generate valid classifications for all types', () => {
      const types = ['bug', 'issue', 'idea', 'question', 'ignore'];

      for (const type of types) {
        const classification = mockClassification(type);

        expect(classification).toBeDefined();
        expect(classification.classification).toBe(type);
        expect(classification.confidence).toBeGreaterThanOrEqual(0);
        expect(classification.confidence).toBeLessThanOrEqual(1);
        expect(classification.reasoning).toBeTypeOf('string');
      }
    });

    it('should generate appropriate suggestions for actionable types', () => {
      const classification = mockClassification('bug');

      expect(classification.suggestedTitle).toBeDefined();
      expect(classification.suggestedLabels).toBeInstanceOf(Array);
      expect(classification.suggestedLabels.length).toBeGreaterThan(0);
    });

    it('should not generate suggestions for ignore type', () => {
      const classification = mockClassification('ignore');

      expect(classification.suggestedTitle).toBeNull();
      expect(classification.suggestedLabels).toEqual([]);
    });
  });

  describe('Database Mocks', () => {
    it('should generate a valid database telegram message record', () => {
      const record = mockDBTelegramMessage();

      expect(record).toBeDefined();
      expect(record.id).toBeTypeOf('string'); // UUID
      expect(record.telegram_message_id).toBeTypeOf('number');
      expect(record.chat_id).toBeTypeOf('number');
      expect(record.message_text).toBeTypeOf('string');
      expect(record.created_at).toBeInstanceOf(Date);
    });
  });
});
