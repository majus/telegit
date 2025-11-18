/**
 * Thread context gathering for conversation threading
 * Collects messages from a conversation thread for context
 */

import { getBot } from './bot.js';
import { ConversationContextRepository } from '../../database/repositories/context.js';

/**
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 */

/**
 * Default TTL for cached context (24 hours)
 */
const DEFAULT_CONTEXT_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Maximum number of messages to collect in a thread
 */
const MAX_THREAD_DEPTH = 20;

/**
 * Gather conversation context from a message thread
 * Walks up the reply chain to collect all messages in the thread
 * @param {Object} ctx - Telegraf context
 * @param {Object} [options] - Options
 * @param {number} [options.maxDepth] - Maximum thread depth to collect
 * @param {boolean} [options.useCache] - Whether to use cached context
 * @param {number} [options.cacheTTL] - Cache TTL in milliseconds
 * @param {TelegrafBot} [options.botInstance] - Bot instance
 * @returns {Promise<Array<Object>>} Array of messages in the thread
 */
export async function gatherThreadContext(ctx, options = {}) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) {
    return [];
  }

  const maxDepth = options.maxDepth ?? MAX_THREAD_DEPTH;
  const useCache = options.useCache ?? true;
  const cacheTTL = options.cacheTTL ?? DEFAULT_CONTEXT_TTL;
  const bot = options.botInstance || getBot();

  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Check if this is a reply
  const replyToMessageId = message.reply_to_message?.message_id;

  if (!replyToMessageId) {
    // Not a reply, return just this message
    return [formatMessage(message)];
  }

  // Generate thread ID (use the root message ID when known, or current for now)
  const threadId = `${chatId}:${messageId}`;

  // Try to get from cache if enabled
  if (useCache) {
    try {
      const contextRepo = new ConversationContextRepository();
      const cached = await contextRepo.getContext(chatId, threadId);

      if (cached && cached.messages) {
        console.log('Using cached thread context:', {
          threadId,
          messageCount: cached.messages.length,
        });
        return cached.messages;
      }
    } catch (error) {
      console.error('Error retrieving cached context:', error.message);
      // Continue with fetching
    }
  }

  // Collect messages by walking up the reply chain
  const messages = [];
  let currentMessage = message;
  let depth = 0;

  try {
    // Add the current message first
    messages.unshift(formatMessage(currentMessage));

    // Walk up the reply chain
    while (currentMessage.reply_to_message && depth < maxDepth) {
      currentMessage = currentMessage.reply_to_message;
      messages.unshift(formatMessage(currentMessage));
      depth++;

      // If we need to fetch more messages (not already in ctx)
      if (!currentMessage.reply_to_message && currentMessage.reply_to_message_id) {
        // Note: Telegram Bot API doesn't provide a direct way to get a message by ID
        // We'd need to use forwardMessage or maintain our own message cache
        // For now, we stop here
        break;
      }
    }

    console.log('Gathered thread context:', {
      threadId,
      messageCount: messages.length,
      depth,
    });

    // Cache the context if enabled
    if (useCache && messages.length > 1) {
      try {
        const contextRepo = new ConversationContextRepository();
        await contextRepo.cacheContext(chatId, threadId, messages, cacheTTL);
      } catch (error) {
        console.error('Error caching context:', error.message);
        // Non-fatal, continue
      }
    }

    return messages;
  } catch (error) {
    console.error('Error gathering thread context:', {
      chatId,
      messageId,
      error: error.message,
    });

    // Return at least the current message
    return [formatMessage(message)];
  }
}

/**
 * Format a Telegram message for context storage
 * @param {Object} message - Telegram message object
 * @returns {Object} Formatted message
 */
function formatMessage(message) {
  return {
    messageId: message.message_id,
    userId: message.from?.id,
    username: message.from?.username,
    firstName: message.from?.first_name,
    lastName: message.from?.last_name,
    text: message.text || message.caption || '',
    date: message.date,
    replyToMessageId: message.reply_to_message?.message_id,
    entities: message.entities || message.caption_entities || [],
    hasPhoto: !!message.photo,
    hasDocument: !!message.document,
    hasVideo: !!message.video,
  };
}

/**
 * Invalidate expired context entries (cleanup job)
 * @returns {Promise<number>} Number of invalidated entries
 */
export async function invalidateExpiredContexts() {
  try {
    const contextRepo = new ConversationContextRepository();
    const count = await contextRepo.invalidateExpiredContexts();

    console.log(`Invalidated ${count} expired context entries`);
    return count;
  } catch (error) {
    console.error('Error invalidating expired contexts:', error.message);
    return 0;
  }
}

/**
 * Start background job for invalidating expired contexts
 * @param {number} [intervalMs] - Check interval in milliseconds (default: 1 hour)
 * @returns {NodeJS.Timeout} Interval ID
 */
export function startContextCleanup(intervalMs = 60 * 60 * 1000) {
  console.log(`Starting context cleanup scheduler (interval: ${intervalMs}ms)`);

  const intervalId = setInterval(async () => {
    await invalidateExpiredContexts();
  }, intervalMs);

  // Run immediately on start
  invalidateExpiredContexts();

  return intervalId;
}

/**
 * Stop the background context cleanup scheduler
 * @param {NodeJS.Timeout} intervalId - Interval ID
 */
export function stopContextCleanup(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('Context cleanup scheduler stopped');
  }
}

/**
 * Build a text summary of thread context for AI processing
 * @param {Array<Object>} messages - Thread messages
 * @returns {string} Formatted context summary
 */
export function buildContextSummary(messages) {
  if (!messages || messages.length === 0) {
    return '';
  }

  if (messages.length === 1) {
    return messages[0].text;
  }

  // Build a conversation summary
  const lines = messages.map((msg, index) => {
    const userName = msg.username || msg.firstName || `User${msg.userId}`;
    const prefix = index === 0 ? '[Original]' : `[Reply ${index}]`;
    return `${prefix} ${userName}: ${msg.text}`;
  });

  return lines.join('\n');
}
