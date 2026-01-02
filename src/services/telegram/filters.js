/**
 * Message filtering for trigger detection and access control
 * Determines whether a message should be processed based on:
 * - Bot mentions (@botname)
 * - Hashtags (#bug, #task, #idea, etc.)
 * - Group whitelist
 * - User whitelist (optional)
 */

import logger from '../../utils/logger.js';

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
    logger.warn('Bot username not available for mention check');
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
 * @param {number[]} allowedChatIds - List of allowed chat IDs (required)
 * @returns {boolean} True if chat is allowed
 */
export function isFromAllowedChat(ctx, allowedChatIds) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return false;

  const chatId = message.chat?.id;
  if (!chatId) return false;

  // If no whitelist is configured, allow all
  if (!allowedChatIds || allowedChatIds.length === 0) {
    return true;
  }

  return allowedChatIds.includes(chatId);
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
 * Filter private messages for setup workflow routing
 * Private messages always pass through to handler, which determines response
 * based on whitelist status and session state
 * @param {MessageContext} ctx - Telegram message context
 * @param {Object} [options] - Filter options
 * @param {number[]} [options.allowedUserIds] - List of allowed user IDs
 * @param {Function} [options.hasActiveSession] - Function to check if user has active session
 * @returns {Object} Private message filter result
 */
export function filterPrivateMessage(ctx, options = {}) {
  const result = {
    shouldProcess: false,
    isWhitelisted: false,
    hasSession: false,
    reason: null,
    metadata: {
      userId: null,
    },
  };

  const message = ctx.message || ctx.editedMessage;
  if (!message) {
    result.reason = 'No message found in context';
    return result;
  }

  const userId = message.from?.id;
  result.metadata.userId = userId;

  if (!userId) {
    result.reason = 'No user ID found';
    return result;
  }

  // Check user whitelist
  result.isWhitelisted = isFromAllowedUser(ctx, options.allowedUserIds);

  if (!result.isWhitelisted) {
    result.reason = `User ${userId} is not in whitelist`;
    return result;
  }

  // Check session status if function provided
  if (options.hasActiveSession) {
    result.hasSession = options.hasActiveSession(userId);
  }

  // User is whitelisted - handler will determine appropriate response
  result.shouldProcess = result.hasSession;
  result.reason = result.hasSession
    ? 'User has active session'
    : 'User is whitelisted but has no active session';

  return result;
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
 * Routes private messages to handler, filters group messages by trigger and whitelist
 * @param {Object} [options] - Filter options
 * @param {number[]} [options.allowedChatIds] - List of allowed chat IDs
 * @param {number[]} [options.allowedUserIds] - List of allowed user IDs
 * @param {Function} [options.hasActiveSession] - Function to check if user has active session
 * @param {boolean} [options.logFiltered] - Whether to log filtered messages
 * @returns {Function} Telegraf middleware function
 */
export function createFilterMiddleware(options = {}) {
  const logFiltered = options.logFiltered ?? false;

  return async (ctx, next) => {
    const message = ctx.message || ctx.editedMessage;
    if (!message) {
      // Allow non-message updates (callback queries, reactions, etc.) to pass through
      return next();
    }

    const chatType = message.chat?.type;
    const chatId = message.chat?.id;
    const isPrivate = chatType === 'private';

    // Debug logging for chat type detection
    logger.debug({
      chatType,
      chatId,
      isPrivate,
      messageText: message.text?.substring(0, 50),
    }, 'Filter middleware: detecting message type');

    // Handle private messages - always route to handler
    if (isPrivate) {
      logger.debug({ chatId }, 'Routing private message to handler');
      const privateResult = filterPrivateMessage(ctx, options);
      ctx.state.isPrivateMessage = true;
      ctx.state.privateFilterResult = privateResult;

      // Always call next() for private messages - handler will determine response
      return next();
    }

    logger.debug({ chatId, chatType }, 'Processing as group message');

    // Handle group messages - filter by trigger and whitelist
    const filterResult = filterMessage(ctx, options);

    if (filterResult.shouldProcess) {
      // Attach filter metadata to context for use in handlers
      ctx.state.filterResult = filterResult;
      ctx.state.isGroupMessage = true;
      return next();
    }

    // Message filtered out
    if (logFiltered) {
      logger.debug({
        chatId: filterResult.metadata.chatId,
        userId: filterResult.metadata.userId,
        reason: filterResult.reason,
      }, 'Message filtered');
    }

    // Do not call next() - stop processing
  };
}
