/**
 * Unit tests for group chat commands
 * Tests /start, /status, and /unlink command handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isGroupChat,
  formatUptime,
  formatOperationsBreakdown,
  gatherOperationStats,
  createStartCommandHandler,
  createUnlinkCommandHandler,
  createUnlinkCallbackHandler,
  createStatusCommandHandler,
} from '../../../src/services/telegram/commands.js';
import { mockTelegramUser, mockTelegramChat, mockTelegramMessage } from '../../mocks/telegram.js';

describe('Command Helpers', () => {
  describe('isGroupChat', () => {
    it('should return true for group chat', () => {
      const ctx = {
        chat: { type: 'group' },
      };
      expect(isGroupChat(ctx)).toBe(true);
    });

    it('should return true for supergroup chat', () => {
      const ctx = {
        chat: { type: 'supergroup' },
      };
      expect(isGroupChat(ctx)).toBe(true);
    });

    it('should return false for private chat', () => {
      const ctx = {
        chat: { type: 'private' },
      };
      expect(isGroupChat(ctx)).toBe(false);
    });

    it('should return false for channel', () => {
      const ctx = {
        chat: { type: 'channel' },
      };
      expect(isGroupChat(ctx)).toBe(false);
    });
  });

  describe('formatUptime', () => {
    it('should format seconds only', () => {
      expect(formatUptime(45)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatUptime(125)).toBe('2m 5s');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatUptime(3665)).toBe('1h 1m 5s');
    });

    it('should format days, hours, minutes, and seconds', () => {
      expect(formatUptime(90061)).toBe('1d 1h 1m 1s');
    });

    it('should handle zero seconds', () => {
      expect(formatUptime(0)).toBe('0s');
    });

    it('should omit zero units', () => {
      expect(formatUptime(3600)).toBe('1h');
    });
  });

  describe('formatOperationsBreakdown', () => {
    it('should format empty operations', () => {
      expect(formatOperationsBreakdown([])).toBe('  (none)');
    });

    it('should format single operation type', () => {
      const operations = [
        { operationType: 'create_bug' },
        { operationType: 'create_bug' },
      ];
      const result = formatOperationsBreakdown(operations);
      expect(result).toContain('👾 create bug: 2');
    });

    it('should format multiple operation types', () => {
      const operations = [
        { operationType: 'create_bug' },
        { operationType: 'create_task' },
        { operationType: 'create_idea' },
      ];
      const result = formatOperationsBreakdown(operations);
      expect(result).toContain('👾 create bug: 1');
      expect(result).toContain('🫡 create task: 1');
      expect(result).toContain('🦄 create idea: 1');
    });

    it('should use fallback emoji for unknown types', () => {
      const operations = [
        { operationType: 'unknown_type' },
      ];
      const result = formatOperationsBreakdown(operations);
      expect(result).toContain('📝 unknown type: 1');
    });
  });

  // Note: gatherOperationStats requires database integration testing
  // Tested via integration tests in test/integration/
});

describe('Command Handlers', () => {
  let mockCtx;
  let mockReply;
  let mockEditMessageText;
  let mockSendMessage;
  let mockAnswerCbQuery;

  beforeEach(() => {
    mockReply = vi.fn().mockResolvedValue({});
    mockEditMessageText = vi.fn().mockResolvedValue({});
    mockSendMessage = vi.fn().mockResolvedValue({});
    mockAnswerCbQuery = vi.fn().mockResolvedValue({});

    mockCtx = {
      chat: mockTelegramChat(),
      from: mockTelegramUser(),
      botInfo: { username: 'testbot' },
      reply: mockReply,
      editMessageText: mockEditMessageText,
      answerCbQuery: mockAnswerCbQuery,
      telegram: {
        sendMessage: mockSendMessage,
        editMessageText: mockEditMessageText,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/start command', () => {
    it('should reject private chats', async () => {
      mockCtx.chat.type = 'private';

      const handler = createStartCommandHandler();
      await handler(mockCtx);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('only works in group chats')
      );
    });

    it('should reject non-whitelisted groups', async () => {
      const handler = createStartCommandHandler({
        filterOptions: {
          allowedChatIds: [999999],
          allowedUserIds: [],
        },
      });

      await handler(mockCtx);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('not authorized')
      );
    });

    it('should reject non-whitelisted users', async () => {
      const handler = createStartCommandHandler({
        filterOptions: {
          allowedChatIds: [mockCtx.chat.id],
          allowedUserIds: [999999],
        },
      });

      await handler(mockCtx);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('not authorized')
      );
    });
  });

  describe('/unlink command', () => {
    it('should reject private chats', async () => {
      mockCtx.chat.type = 'private';

      const handler = createUnlinkCommandHandler();
      await handler(mockCtx);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('only works in group chats')
      );
    });
  });

  describe('/status command', () => {
    it('should reject private chats', async () => {
      mockCtx.chat.type = 'private';

      const handler = createStatusCommandHandler();
      await handler(mockCtx);

      expect(mockReply).toHaveBeenCalledWith(
        expect.stringContaining('only works in group chats')
      );
    });
  });

  describe('unlink callback handler', () => {
    it('should handle cancel action', async () => {
      mockCtx.callbackQuery = {
        data: 'unlink_cancel_123456',
      };

      const handler = createUnlinkCallbackHandler();
      await handler(mockCtx);

      expect(mockEditMessageText).toHaveBeenCalledWith(
        expect.stringContaining('cancelled')
      );
      expect(mockAnswerCbQuery).toHaveBeenCalledWith('Cancelled');
    });

    it('should ignore non-unlink callbacks', async () => {
      mockCtx.callbackQuery = {
        data: 'other_action_123',
      };

      const handler = createUnlinkCallbackHandler();
      await handler(mockCtx);

      expect(mockEditMessageText).not.toHaveBeenCalled();
      expect(mockAnswerCbQuery).not.toHaveBeenCalled();
    });
  });
});
