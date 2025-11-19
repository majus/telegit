/**
 * Message filtering for trigger detection and access control
 * Determines whether a message should be processed based on:
 * - Bot mentions (@botname)
 * - Hashtags (#bug, #task, #idea, etc.)
 * - Group whitelist
 * - User whitelist (optional)
 */

import { getConfig } from '../../../config/env.js';

/**
 * @typedef {import('telegraf').Context} Context
 * @typedef {import('../../types/bot.js').MessageContext} MessageContext
 * @typedef {import('../../types/bot.js').FilterResult} FilterResult
 */

/**
 * Check if message contains a mention of the bot
 * @param {MessageContext} ctx - Telegram message context
 * @returns {boolean} True if bot is mentioned
 */
export function isBotMentioned(ctx) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return false;

  const botUsername = ctx.botInfo?.username;
  if (!botUsername) {
    console.warn('Bot username not available for mention check');
    return false;
  }

  // Check for @mention in message text
  const text = message.text || message.caption || '';
  const mentionPattern = new RegExp(`@${botUsername}\\b`, 'i');

  if (mentionPattern.test(text)) {
    return true;
  }

  // Check for mention in entities
  const entities = message.entities || message.caption_entities || [];
  for (const entity of entities) {
    if (entity.type === 'mention' || entity.type === 'text_mention') {
      const mentionText = text.substring(entity.offset, entity.offset + entity.length);
      if (mentionText.toLowerCase() === `@${botUsername.toLowerCase()}`) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if message contains hashtags
 * @param {MessageContext} ctx - Telegram message context
 * @returns {string[]} Array of hashtags found (without # prefix)
 */
export function extractHashtags(ctx) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return [];

  const text = message.text || message.caption || '';
  const entities = message.entities || message.caption_entities || [];

  const hashtags = [];

  // Extract hashtags from entities
  for (const entity of entities) {
    if (entity.type === 'hashtag') {
      const hashtagText = text.substring(entity.offset, entity.offset + entity.length);
      // Remove # prefix and add to array
      hashtags.push(hashtagText.substring(1).toLowerCase());
    }
  }

  return hashtags;
}

/**
 * Check if message has any hashtags
 * @param {MessageContext} ctx - Telegram message context
 * @returns {boolean} True if message contains at least one hashtag
 */
export function hasHashtags(ctx) {
  return extractHashtags(ctx).length > 0;
}

/**
 * Check if message is from an allowed chat/group
 * @param {MessageContext} ctx - Telegram message context
 * @param {number[]} [allowedChatIds] - List of allowed chat IDs (optional, defaults to config)
 * @returns {boolean} True if chat is allowed
 */
export function isFromAllowedChat(ctx, allowedChatIds = null) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return false;

  const chatId = message.chat?.id;
  if (!chatId) return false;

  // Get allowed chat IDs from config if not provided (undefined means use config)
  const allowed = allowedChatIds === undefined ? getConfig().telegram.allowedChatIds : allowedChatIds;

  // If no whitelist is configured, allow all
  if (!allowed || allowed.length === 0) {
    return true;
  }

  return allowed.includes(chatId);
}

/**
 * Check if message is from an allowed user
 * @param {MessageContext} ctx - Telegram message context
 * @param {number[]} [allowedUserIds] - List of allowed user IDs (optional)
 * @returns {boolean} True if user is allowed
 */
export function isFromAllowedUser(ctx, allowedUserIds = null) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return false;

  const userId = message.from?.id;
  if (!userId) return false;

  // If no whitelist is configured, allow all
  if (!allowedUserIds || allowedUserIds.length === 0) {
    return true;
  }

  return allowedUserIds.includes(userId);
}

/**
 * Check if message should trigger bot processing
 * A message triggers the bot if it contains either:
 * - A bot mention (@botname)
 * - At least one hashtag (#tag)
 * @param {MessageContext} ctx - Telegram message context
 * @returns {boolean} True if message should trigger bot
 */
export function isTriggered(ctx) {
  return isBotMentioned(ctx) || hasHashtags(ctx);
}

/**
 * Complete filter check: combines trigger detection with access control
 * @param {MessageContext} ctx - Telegram message context
 * @param {Object} [options] - Filter options
 * @param {number[]} [options.allowedChatIds] - List of allowed chat IDs
 * @param {number[]} [options.allowedUserIds] - List of allowed user IDs
 * @returns {FilterResult} Filter result with detailed information
 */
export function filterMessage(ctx, options = {}) {
  const result = {
    shouldProcess: false,
    triggered: false,
    hasAccess: false,
    reason: null,
    metadata: {
      botMentioned: false,
      hashtags: [],
      chatAllowed: false,
      userAllowed: false,
      chatId: null,
      userId: null,
    },
  };

  const message = ctx.message || ctx.editedMessage;
  if (!message) {
    result.reason = 'No message found in context';
    return result;
  }

  // Extract metadata
  result.metadata.chatId = message.chat?.id || null;
  result.metadata.userId = message.from?.id || null;
  result.metadata.botMentioned = isBotMentioned(ctx);
  result.metadata.hashtags = extractHashtags(ctx);

  // Check trigger conditions
  result.triggered = result.metadata.botMentioned || result.metadata.hashtags.length > 0;

  if (!result.triggered) {
    result.reason = 'Message not triggered (no mention or hashtags)';
    return result;
  }

  // Check access control
  result.metadata.chatAllowed = isFromAllowedChat(ctx, options.allowedChatIds);
  result.metadata.userAllowed = isFromAllowedUser(ctx, options.allowedUserIds);

  result.hasAccess = result.metadata.chatAllowed && result.metadata.userAllowed;

  if (!result.metadata.chatAllowed) {
    result.reason = `Chat ${result.metadata.chatId} is not in whitelist`;
    return result;
  }

  if (!result.metadata.userAllowed) {
    result.reason = `User ${result.metadata.userId} is not in whitelist`;
    return result;
  }

  // All checks passed
  result.shouldProcess = true;
  result.reason = 'Message should be processed';

  return result;
}

/**
 * Telegraf middleware for message filtering
 * Only allows triggered messages from whitelisted chats/users to proceed
 * @param {Object} [options] - Filter options
 * @param {number[]} [options.allowedChatIds] - List of allowed chat IDs
 * @param {number[]} [options.allowedUserIds] - List of allowed user IDs
 * @param {boolean} [options.logFiltered] - Whether to log filtered messages
 * @returns {Function} Telegraf middleware function
 */
export function createFilterMiddleware(options = {}) {
  const logFiltered = options.logFiltered ?? false;

  return async (ctx, next) => {
    const filterResult = filterMessage(ctx, options);

    if (filterResult.shouldProcess) {
      // Attach filter metadata to context for use in handlers
      ctx.state.filterResult = filterResult;
      return next();
    }

    // Message filtered out
    if (logFiltered) {
      console.log('Message filtered:', {
        chatId: filterResult.metadata.chatId,
        userId: filterResult.metadata.userId,
        reason: filterResult.reason,
      });
    }

    // Do not call next() - stop processing
  };
}
