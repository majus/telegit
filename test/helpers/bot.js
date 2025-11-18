/**
 * Test helpers for Telegram bot instances
 * Provides utilities for testing bot functionality
 */

import { Telegraf } from 'telegraf';
import { vi } from 'vitest';

/**
 * Create a test bot instance with mocked Telegram API
 * @param {object} options - Bot configuration options
 * @returns {object} Test bot instance with helpers
 */
export function createTestBot(options = {}) {
  const token = options.token || 'test_token:ABC123';
  const bot = new Telegraf(token);

  // Mock the telegram API methods
  bot.telegram.sendMessage = vi.fn().mockResolvedValue({
    message_id: Math.floor(Math.random() * 999999),
    chat: { id: 123 },
    date: Math.floor(Date.now() / 1000),
    text: 'Test message',
  });

  bot.telegram.editMessageText = vi.fn().mockResolvedValue(true);
  bot.telegram.deleteMessage = vi.fn().mockResolvedValue(true);
  bot.telegram.setMessageReaction = vi.fn().mockResolvedValue(true);
  bot.telegram.getMe = vi.fn().mockResolvedValue({
    id: 123456789,
    is_bot: true,
    first_name: 'TestBot',
    username: 'test_bot',
  });

  // Prevent actual API calls during tests
  bot.launch = vi.fn().mockResolvedValue(undefined);
  bot.stop = vi.fn().mockResolvedValue(undefined);

  return {
    bot,
    telegram: bot.telegram,
    /**
     * Simulate receiving an update from Telegram
     * @param {object} update - Telegram update object
     */
    handleUpdate: async (update) => {
      return bot.handleUpdate(update);
    },
    /**
     * Clear all mocks
     */
    clearMocks: () => {
      vi.clearAllMocks();
    },
    /**
     * Get call history for a specific method
     * @param {string} method - Method name (e.g., 'sendMessage')
     */
    getCallHistory: (method) => {
      return bot.telegram[method].mock.calls;
    },
  };
}

/**
 * Create a mock bot context for testing handlers
 * @param {object} update - Telegram update object
 * @param {object} bot - Bot instance
 * @returns {object} Mock context
 */
export function createMockContext(update, bot) {
  const ctx = {
    update: update,
    telegram: bot?.telegram || {
      sendMessage: vi.fn(),
      editMessageText: vi.fn(),
      deleteMessage: vi.fn(),
      setMessageReaction: vi.fn(),
    },
    message: update.message,
    chat: update.message?.chat,
    from: update.message?.from,
    reply: vi.fn().mockResolvedValue({
      message_id: Math.floor(Math.random() * 999999),
    }),
    replyWithHTML: vi.fn().mockResolvedValue({
      message_id: Math.floor(Math.random() * 999999),
    }),
    replyWithMarkdown: vi.fn().mockResolvedValue({
      message_id: Math.floor(Math.random() * 999999),
    }),
    editMessageText: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(true),
    react: vi.fn().mockResolvedValue(true),
  };

  return ctx;
}

/**
 * Wait for bot to process all pending updates
 * @param {number} ms - Milliseconds to wait
 */
export async function waitForBot(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that a message was sent with specific content
 * @param {object} telegram - Bot telegram instance
 * @param {number|string} chatId - Chat ID
 * @param {string} expectedText - Expected text (can be partial)
 */
export function assertMessageSent(telegram, chatId, expectedText) {
  const calls = telegram.sendMessage.mock.calls;
  const found = calls.some(([id, text]) => {
    return id === chatId && text.includes(expectedText);
  });

  if (!found) {
    throw new Error(
      `Expected message containing "${expectedText}" to be sent to chat ${chatId}, but it was not found in:\n${
        calls.map(c => `  - Chat ${c[0]}: "${c[1]}"`).join('\n')
      }`
    );
  }
}

/**
 * Assert that a reaction was set on a message
 * @param {object} telegram - Bot telegram instance
 * @param {number|string} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {string} expectedReaction - Expected reaction emoji
 */
export function assertReactionSet(telegram, chatId, messageId, expectedReaction) {
  const calls = telegram.setMessageReaction.mock.calls;
  const found = calls.some(([id, msgId, options]) => {
    return id === chatId && msgId === messageId && options?.reaction?.some(r => r.emoji === expectedReaction);
  });

  if (!found) {
    throw new Error(
      `Expected reaction "${expectedReaction}" on message ${messageId} in chat ${chatId}, but it was not found`
    );
  }
}

/**
 * Get the last message sent to a specific chat
 * @param {object} telegram - Bot telegram instance
 * @param {number|string} chatId - Chat ID
 * @returns {string|null} Last message text or null
 */
export function getLastMessageTo(telegram, chatId) {
  const calls = telegram.sendMessage.mock.calls;
  const lastCall = calls.filter(([id]) => id === chatId).pop();
  return lastCall ? lastCall[1] : null;
}
