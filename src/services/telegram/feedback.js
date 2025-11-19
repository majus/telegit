/**
 * Feedback message lifecycle management
 * Handles posting and auto-deleting feedback messages
 */

import { getBot } from './bot.js';
import { FeedbackRepository } from '../../database/repositories/feedback.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 */

/**
 * Configuration constants
 */
export const DELETION_DELAY_MS = 10 * 60 * 1000; // 10 minutes
export const DELETION_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Post a feedback message as a reply to the original message
 * @param {number} chatId - Chat ID where to post the feedback
 * @param {number} replyToMessageId - Message ID to reply to
 * @param {string} message - Feedback message text (markdown supported)
 * @param {number} operationId - Associated operation ID
 * @param {Object} [options] - Additional options
 * @param {number} [options.deletionDelay] - Custom deletion delay in ms
 * @param {TelegrafBot} [options.botInstance] - Bot instance
 * @returns {Promise<Object>} Posted message info
 */
export async function postFeedback(chatId, replyToMessageId, message, operationId, options = {}) {
  const bot = options.botInstance || getBot();
  const deletionDelay = options.deletionDelay ?? DELETION_DELAY_MS;

  if (!bot) {
    throw new Error('Bot instance not initialized');
  }

  try {
    // Post the feedback message
    const sentMessage = await bot.telegram.sendMessage(chatId, message, {
      reply_to_message_id: replyToMessageId,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    const feedbackMessageId = sentMessage.message_id;

    // Calculate scheduled deletion time
    const scheduledDeletion = new Date(Date.now() + deletionDelay);

    // Store feedback record in database
    const feedbackRepo = new FeedbackRepository();
    await feedbackRepo.createFeedback({ operationId, chatId, feedbackMessageId, scheduledDeletion });

    logger.debug({
      chatId,
      feedbackMessageId,
      operationId,
      scheduledDeletion,
    }, 'Feedback posted');

    return {
      messageId: feedbackMessageId,
      chatId,
      scheduledDeletion,
    };
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      replyToMessageId,
      operationId,
    }, 'Failed to post feedback');
    throw error;
  }
}

/**
 * Delete a feedback message immediately
 * Deletes the Telegram message but preserves the database record for audit/history
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID to delete
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteFeedbackMessage(chatId, messageId, botInstance = null) {
  const bot = botInstance || getBot();

  if (!bot) {
    throw new Error('Bot instance not initialized');
  }

  try {
    await bot.telegram.deleteMessage(chatId, messageId);

    // Mark as dismissed in database (preserve record for audit/history)
    const feedbackRepo = new FeedbackRepository();
    await feedbackRepo.markDismissed(messageId);

    logger.debug({ chatId, messageId }, 'Feedback message deleted');
    return true;
  } catch (error) {
    // Message might already be deleted or not exist
    if (error.response?.error_code === 400) {
      logger.debug({ chatId, messageId }, 'Feedback message already deleted');

      // Still mark as dismissed in database
      try {
        const feedbackRepo = new FeedbackRepository();
        await feedbackRepo.markDismissed(messageId);
      } catch (dbError) {
        // Non-fatal if already dismissed
        logger.debug({ err: dbError }, 'Could not mark as dismissed (may already be dismissed)');
      }

      return true;
    }

    logger.error({
      err: error,
      chatId,
      messageId,
    }, 'Failed to delete feedback message');
    return false;
  }
}

/**
 * Dismiss a feedback message (user requested immediate deletion)
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Feedback message ID
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<boolean>} True if dismissed successfully
 */
export async function dismissFeedback(chatId, messageId, botInstance = null) {
  try {
    const feedbackRepo = new FeedbackRepository();

    // Mark as dismissed in database
    await feedbackRepo.markDismissed(messageId);

    // Delete the message
    return await deleteFeedbackMessage(chatId, messageId, botInstance);
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      messageId,
    }, 'Failed to dismiss feedback');
    return false;
  }
}

/**
 * Process scheduled deletions (should be run periodically)
 * Deletes all feedback messages that have reached their scheduled deletion time
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {Promise<Object>} Processing results
 */
export async function processScheduledDeletions(botInstance = null) {
  const bot = botInstance || getBot();

  if (!bot) {
    logger.warn('Bot instance not initialized, skipping scheduled deletions');
    return { processed: 0, deleted: 0, errors: 0 };
  }

  try {
    const feedbackRepo = new FeedbackRepository();
    const scheduled = await feedbackRepo.getScheduledDeletions();

    logger.debug({ count: scheduled.length }, 'Processing scheduled deletions');

    let deleted = 0;
    let errors = 0;

    for (const feedback of scheduled) {
      try {
        const success = await deleteFeedbackMessage(
          feedback.chatId,
          feedback.feedbackMessageId,
          bot
        );

        if (success) {
          deleted++;
        } else {
          errors++;
        }
      } catch (error) {
        logger.error({
          err: error,
          feedbackId: feedback.id,
          messageId: feedback.feedbackMessageId,
        }, 'Error deleting scheduled feedback');
        errors++;
      }
    }

    logger.info({
      total: scheduled.length,
      deleted,
      errors,
    }, 'Scheduled deletions processed');

    return {
      processed: scheduled.length,
      deleted,
      errors,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to process scheduled deletions');
    return {
      processed: 0,
      deleted: 0,
      errors: 1,
    };
  }
}

/**
 * Start background job for processing scheduled deletions
 * @param {number} [intervalMs] - Check interval in milliseconds
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {NodeJS.Timeout} Interval ID (can be used with clearInterval)
 */
export function startDeletionScheduler(intervalMs = DELETION_CHECK_INTERVAL_MS, botInstance = null) {
  logger.info({ intervalMs }, 'Starting deletion scheduler');

  const intervalId = setInterval(async () => {
    await processScheduledDeletions(botInstance);
  }, intervalMs);

  // Run immediately on start
  processScheduledDeletions(botInstance);

  return intervalId;
}

/**
 * Stop the background deletion scheduler
 * @param {NodeJS.Timeout} intervalId - Interval ID returned by startDeletionScheduler
 */
export function stopDeletionScheduler(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    logger.info('Deletion scheduler stopped');
  }
}
