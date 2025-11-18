/**
 * Unit tests for message filtering
 * Tests trigger detection, access control, and filter middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isBotMentioned,
  extractHashtags,
  hasHashtags,
  isFromAllowedChat,
  isFromAllowedUser,
  isTriggered,
  filterMessage,
  createFilterMiddleware,
} from '../../../src/services/telegram/filters.js';
import { mockTelegramMessage, mockTelegramUser, mockTelegramChat } from '../../mocks/telegram.js';

describe('Message Filtering', () => {
  describe('isBotMentioned', () => {
    it('should detect bot mention in text', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Hey @testbot, create an issue',
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(true);
    });

    it('should detect bot mention case-insensitively', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Hey @TestBot, create an issue',
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(true);
    });

    it('should detect bot mention with entities', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot please help',
          entities: [
            {
              type: 'mention',
              offset: 0,
              length: 8,
            },
          ],
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(true);
    });

    it('should not detect mention of different bot', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Hey @otherbot, do something',
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(false);
    });

    it('should not detect partial bot name matches', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Hey @testbotv2, do something',
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(false);
    });

    it('should return false when no bot info available', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot help',
        }),
        botInfo: null,
      };

      expect(isBotMentioned(ctx)).toBe(false);
    });

    it('should return false when no message in context', () => {
      const ctx = {
        botInfo: { username: 'testbot' },
      };

      expect(isBotMentioned(ctx)).toBe(false);
    });
  });

  describe('extractHashtags', () => {
    it('should extract single hashtag', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'This is a #bug report',
          entities: [
            {
              type: 'hashtag',
              offset: 10,
              length: 4,
            },
          ],
        }),
      };

      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual(['bug']);
    });

    it('should extract multiple hashtags', () => {
      const text = 'Found a #bug that needs #urgent attention #critical';
      const ctx = {
        message: mockTelegramMessage({
          text: text,
          entities: [
            { type: 'hashtag', offset: text.indexOf('#bug'), length: 4 },
            { type: 'hashtag', offset: text.indexOf('#urgent'), length: 7 },
            { type: 'hashtag', offset: text.indexOf('#critical'), length: 9 },
          ],
        }),
      };

      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual(['bug', 'urgent', 'critical']);
    });

    it('should return hashtags in lowercase', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'This is #BUG report',
          entities: [
            {
              type: 'hashtag',
              offset: 8,
              length: 4,
            },
          ],
        }),
      };

      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual(['bug']);
    });

    it('should return empty array when no hashtags', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'No hashtags here',
          entities: [],
        }),
      };

      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual([]);
    });

    it('should extract hashtags from caption', () => {
      const caption = 'Image showing #bug';
      const ctx = {
        message: {
          ...mockTelegramMessage({ text: undefined }),
          caption: caption,
          caption_entities: [
            {
              type: 'hashtag',
              offset: caption.indexOf('#bug'),
              length: 4,
            },
          ],
        },
      };

      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual(['bug']);
    });

    it('should return empty array when no message', () => {
      const ctx = {};
      const hashtags = extractHashtags(ctx);
      expect(hashtags).toEqual([]);
    });
  });

  describe('hasHashtags', () => {
    it('should return true when message has hashtags', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'This is a #bug',
          entities: [{ type: 'hashtag', offset: 10, length: 4 }],
        }),
      };

      expect(hasHashtags(ctx)).toBe(true);
    });

    it('should return false when message has no hashtags', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'No hashtags here',
          entities: [],
        }),
      };

      expect(hasHashtags(ctx)).toBe(false);
    });
  });

  describe('isFromAllowedChat', () => {
    it('should allow chat in whitelist', () => {
      const chatId = -123456789;
      const ctx = {
        message: mockTelegramMessage({
          chat: mockTelegramChat({ id: chatId }),
        }),
      };

      expect(isFromAllowedChat(ctx, [chatId])).toBe(true);
    });

    it('should reject chat not in whitelist', () => {
      const ctx = {
        message: mockTelegramMessage({
          chat: mockTelegramChat({ id: -123456789 }),
        }),
      };

      expect(isFromAllowedChat(ctx, [-987654321])).toBe(false);
    });

    it('should allow all chats when whitelist is empty', () => {
      const ctx = {
        message: mockTelegramMessage(),
      };

      expect(isFromAllowedChat(ctx, [])).toBe(true);
    });

    it('should allow all chats when whitelist is null', () => {
      const ctx = {
        message: mockTelegramMessage(),
      };

      expect(isFromAllowedChat(ctx, null)).toBe(true);
    });

    it('should return false when no message in context', () => {
      const ctx = {};
      expect(isFromAllowedChat(ctx, [-123456789])).toBe(false);
    });
  });

  describe('isFromAllowedUser', () => {
    it('should allow user in whitelist', () => {
      const userId = 123456;
      const ctx = {
        message: mockTelegramMessage({
          from: mockTelegramUser({ id: userId }),
        }),
      };

      expect(isFromAllowedUser(ctx, [userId])).toBe(true);
    });

    it('should reject user not in whitelist', () => {
      const ctx = {
        message: mockTelegramMessage({
          from: mockTelegramUser({ id: 123456 }),
        }),
      };

      expect(isFromAllowedUser(ctx, [999999])).toBe(false);
    });

    it('should allow all users when whitelist is empty', () => {
      const ctx = {
        message: mockTelegramMessage(),
      };

      expect(isFromAllowedUser(ctx, [])).toBe(true);
    });

    it('should allow all users when whitelist is null', () => {
      const ctx = {
        message: mockTelegramMessage(),
      };

      expect(isFromAllowedUser(ctx, null)).toBe(true);
    });

    it('should return false when no message in context', () => {
      const ctx = {};
      expect(isFromAllowedUser(ctx, [123456])).toBe(false);
    });
  });

  describe('isTriggered', () => {
    it('should trigger on bot mention', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot help',
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isTriggered(ctx)).toBe(true);
    });

    it('should trigger on hashtag', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Found a #bug',
          entities: [{ type: 'hashtag', offset: 8, length: 4 }],
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isTriggered(ctx)).toBe(true);
    });

    it('should trigger on both mention and hashtag', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot this is a #bug',
          entities: [
            { type: 'mention', offset: 0, length: 8 },
            { type: 'hashtag', offset: 19, length: 4 },
          ],
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isTriggered(ctx)).toBe(true);
    });

    it('should not trigger without mention or hashtag', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Just a normal message',
          entities: [],
        }),
        botInfo: { username: 'testbot' },
      };

      expect(isTriggered(ctx)).toBe(false);
    });
  });

  describe('filterMessage', () => {
    it('should pass all checks for valid triggered message', () => {
      const chatId = -123456789;
      const userId = 123456;

      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot create #bug report',
          entities: [
            { type: 'mention', offset: 0, length: 8 },
            { type: 'hashtag', offset: 16, length: 4 },
          ],
          chat: mockTelegramChat({ id: chatId }),
          from: mockTelegramUser({ id: userId }),
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx, {
        allowedChatIds: [chatId],
        allowedUserIds: [userId],
      });

      expect(result.shouldProcess).toBe(true);
      expect(result.triggered).toBe(true);
      expect(result.hasAccess).toBe(true);
      expect(result.metadata.botMentioned).toBe(true);
      expect(result.metadata.hashtags).toEqual(['bug']);
      expect(result.metadata.chatAllowed).toBe(true);
      expect(result.metadata.userAllowed).toBe(true);
    });

    it('should reject non-triggered message', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: 'Just chatting',
          entities: [],
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx);

      expect(result.shouldProcess).toBe(false);
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('not triggered');
    });

    it('should reject message from non-whitelisted chat', () => {
      const ctx = {
        message: mockTelegramMessage({
          text: '#bug report',
          entities: [{ type: 'hashtag', offset: 0, length: 4 }],
          chat: mockTelegramChat({ id: -123456789 }),
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx, {
        allowedChatIds: [-987654321],
      });

      expect(result.shouldProcess).toBe(false);
      expect(result.triggered).toBe(true);
      expect(result.hasAccess).toBe(false);
      expect(result.metadata.chatAllowed).toBe(false);
      expect(result.reason).toContain('not in whitelist');
    });

    it('should reject message from non-whitelisted user', () => {
      const chatId = -123456789;

      const ctx = {
        message: mockTelegramMessage({
          text: '#task to do',
          entities: [{ type: 'hashtag', offset: 0, length: 5 }],
          chat: mockTelegramChat({ id: chatId }),
          from: mockTelegramUser({ id: 123456 }),
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx, {
        allowedChatIds: [chatId],
        allowedUserIds: [999999],
      });

      expect(result.shouldProcess).toBe(false);
      expect(result.triggered).toBe(true);
      expect(result.hasAccess).toBe(false);
      expect(result.metadata.userAllowed).toBe(false);
      expect(result.reason).toContain('not in whitelist');
    });

    it('should handle message with only hashtag', () => {
      const chatId = -123456789;

      const ctx = {
        message: mockTelegramMessage({
          text: 'This is a #bug',
          entities: [{ type: 'hashtag', offset: 10, length: 4 }],
          chat: mockTelegramChat({ id: chatId }),
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx, {
        allowedChatIds: [chatId],
      });

      expect(result.shouldProcess).toBe(true);
      expect(result.metadata.botMentioned).toBe(false);
      expect(result.metadata.hashtags).toEqual(['bug']);
    });

    it('should handle message with only bot mention', () => {
      const chatId = -123456789;

      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot help me',
          chat: mockTelegramChat({ id: chatId }),
        }),
        botInfo: { username: 'testbot' },
      };

      const result = filterMessage(ctx, {
        allowedChatIds: [chatId],
      });

      expect(result.shouldProcess).toBe(true);
      expect(result.metadata.botMentioned).toBe(true);
      expect(result.metadata.hashtags).toEqual([]);
    });
  });

  describe('createFilterMiddleware', () => {
    it('should call next() for valid message', async () => {
      const chatId = -123456789;
      let nextCalled = false;

      const ctx = {
        message: mockTelegramMessage({
          text: '@testbot #bug report',
          entities: [
            { type: 'mention', offset: 0, length: 8 },
            { type: 'hashtag', offset: 9, length: 4 },
          ],
          chat: mockTelegramChat({ id: chatId }),
        }),
        botInfo: { username: 'testbot' },
        state: {},
      };

      const middleware = createFilterMiddleware({
        allowedChatIds: [chatId],
      });

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(ctx.state.filterResult).toBeDefined();
      expect(ctx.state.filterResult.shouldProcess).toBe(true);
    });

    it('should not call next() for filtered message', async () => {
      let nextCalled = false;

      const ctx = {
        message: mockTelegramMessage({
          text: 'Normal chat message',
          entities: [],
        }),
        botInfo: { username: 'testbot' },
        state: {},
      };

      const middleware = createFilterMiddleware();

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
    });

    it('should not call next() for non-whitelisted chat', async () => {
      let nextCalled = false;

      const ctx = {
        message: mockTelegramMessage({
          text: '#bug report',
          entities: [{ type: 'hashtag', offset: 0, length: 4 }],
          chat: mockTelegramChat({ id: -123456789 }),
        }),
        botInfo: { username: 'testbot' },
        state: {},
      };

      const middleware = createFilterMiddleware({
        allowedChatIds: [-987654321],
      });

      await middleware(ctx, async () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
    });
  });
});
