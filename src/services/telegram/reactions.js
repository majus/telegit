/**
 * Reaction management for status updates and user controls
 * Handles bot status reactions and user control reactions
 */

import { getBot } from './bot.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 */

/**
 * Status reaction emojis for bot operations
 */
export const StatusReactions = {
  ANALYZING: '👀', // Bot is analyzing the message
  PROCESSING: '🤔', // Bot is processing/executing operation
  SUCCESS_BUG: '👾', // Successfully created bug issue
  SUCCESS_TASK: '🫡', // Successfully created task issue
  SUCCESS_IDEA: '🦄', // Successfully created idea/feature
  ERROR: '😱', // Error occurred during processing
};

/**
 * User control reaction emojis
 */
export const ControlReactions = {
  UNDO: '👎', // User wants to undo the operation
  DISMISS: '👍', // User wants to dismiss feedback message
};

/**
 * All reaction emojis used by the bot
 */
export const AllReactions = {
  ...StatusReactions,
  ...ControlReactions,
};

/**
 * Set or update a reaction on a message
 * @param {number} chatId - Chat ID where the message is located
 * @param {number} messageId - Message ID to react to
 * @param {string} emoji - Emoji to use for the reaction
 * @param {TelegrafBot} [botInstance] - Bot instance (optional, uses singleton if not provided)
 * @returns {Promise<boolean>} True if reaction was set successfully
 */
export async function setReaction(chatId, messageId, emoji, botInstance = null) {
  const bot = botInstance || getBot();

  if (!bot) {
    throw new Error('Bot instance not initialized');
  }

  try {
    await bot.telegram.setMessageReaction(chatId, messageId, [
      {
        type: 'emoji',
        emoji: emoji,
      },
    ]);
    return true;
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      messageId,
      emoji,
    }, 'Failed to set reaction');
    return false;
  }
}

/**
 * Remove all reactions from a message
 * @param {number} chatId - Chat ID where the message is located
 * @param {number} messageId - Message ID to remove reactions from
 * @param {TelegrafBot} [botInstance] - Bot instance (optional, uses singleton if not provided)
 * @returns {Promise<boolean>} True if reactions were removed successfully
 */
export async function removeReaction(chatId, messageId, botInstance = null) {
  const bot = botInstance || getBot();

  if (!bot) {
    throw new Error('Bot instance not initialized');
  }

  try {
    await bot.telegram.setMessageReaction(chatId, messageId, []);
    return true;
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      messageId,
    }, 'Failed to remove reaction');
    return false;
  }
}

/**
 * Set analyzing status reaction (👀)
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>}
 */
export async function setAnalyzingReaction(chatId, messageId, botInstance = null) {
  return setReaction(chatId, messageId, StatusReactions.ANALYZING, botInstance);
}

/**
 * Set processing status reaction (🤔)
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>}
 */
export async function setProcessingReaction(chatId, messageId, botInstance = null) {
  return setReaction(chatId, messageId, StatusReactions.PROCESSING, botInstance);
}

/**
 * Set success reaction based on operation type
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {'bug'|'task'|'idea'|string} operationType - Type of operation completed
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>}
 */
export async function setSuccessReaction(chatId, messageId, operationType, botInstance = null) {
  let emoji;

  switch (operationType?.toLowerCase()) {
    case 'bug':
    case 'create_bug':
      emoji = StatusReactions.SUCCESS_BUG;
      break;
    case 'task':
    case 'create_task':
      emoji = StatusReactions.SUCCESS_TASK;
      break;
    case 'idea':
    case 'create_idea':
    case 'feature':
      emoji = StatusReactions.SUCCESS_IDEA;
      break;
    default:
      // Default to bug emoji for unknown types
      emoji = StatusReactions.SUCCESS_BUG;
  }

  return setReaction(chatId, messageId, emoji, botInstance);
}

/**
 * Set error reaction (😱)
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>}
 */
export async function setErrorReaction(chatId, messageId, botInstance = null) {
  return setReaction(chatId, messageId, StatusReactions.ERROR, botInstance);
}

/**
 * Check if a reaction is a control reaction (undo or dismiss)
 * @param {string} emoji - Emoji to check
 * @returns {boolean} True if it's a control reaction
 */
export function isControlReaction(emoji) {
  return Object.values(ControlReactions).includes(emoji);
}

/**
 * Check if a reaction is an undo reaction
 * @param {string} emoji - Emoji to check
 * @returns {boolean} True if it's an undo reaction
 */
export function isUndoReaction(emoji) {
  return emoji === ControlReactions.UNDO;
}

/**
 * Check if a reaction is a dismiss reaction
 * @param {string} emoji - Emoji to check
 * @returns {boolean} True if it's a dismiss reaction
 */
export function isDismissReaction(emoji) {
  return emoji === ControlReactions.DISMISS;
}

/**
 * Get user reactions from a message
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<Array<{emoji: string, userId: number}>>} Array of reactions with user IDs
 */
export async function getUserReactions(chatId, messageId, botInstance = null) {
  const bot = botInstance || getBot();

  if (!bot) {
    throw new Error('Bot instance not initialized');
  }

  try {
    // Note: Getting reactions requires fetching the message with reactions
    // This is a placeholder - actual implementation may vary based on Telegram API
    const message = await bot.telegram.forwardMessage(chatId, chatId, messageId);

    // Extract reactions if available
    // The actual structure depends on Telegram API response
    return message.reactions || [];
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      messageId,
    }, 'Failed to get user reactions');
    return [];
  }
}

/**
 * React to a reaction update (handle user control reactions)
 * This is a helper to process message_reaction updates
 * @param {Object} reactionUpdate - Reaction update from Telegram
 * @returns {Object} Parsed reaction information
 */
export function parseReactionUpdate(reactionUpdate) {
  const chatId = reactionUpdate.chat?.id;
  const messageId = reactionUpdate.message_id;
  const userId = reactionUpdate.user?.id;
  const newReactions = reactionUpdate.new_reaction || [];
  const oldReactions = reactionUpdate.old_reaction || [];

  // Extract emoji reactions (filter out custom emojis)
  const newEmojis = newReactions
    .filter(r => r.type === 'emoji')
    .map(r => r.emoji);

  const oldEmojis = oldReactions
    .filter(r => r.type === 'emoji')
    .map(r => r.emoji);

  // Find added reactions
  const addedReactions = newEmojis.filter(emoji => !oldEmojis.includes(emoji));

  // Find removed reactions
  const removedReactions = oldEmojis.filter(emoji => !newEmojis.includes(emoji));

  return {
    chatId,
    messageId,
    userId,
    addedReactions,
    removedReactions,
    allReactions: newEmojis,
    hasUndo: newEmojis.includes(ControlReactions.UNDO),
    hasDismiss: newEmojis.includes(ControlReactions.DISMISS),
  };
}
