/**
 * Feedback message lifecycle management
 * Handles posting and auto-deleting feedback messages
 */

import { getBot } from './bot.js';
import { FeedbackRepository } from '../../database/repositories/feedback.js';

/**
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 */

/**
 * Default feedback deletion delay in milliseconds (10 minutes)
 */
export const DEFAULT_DELETION_DELAY = 10 * 60 * 1000; // 10 minutes

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
  const deletionDelay = options.deletionDelay ?? DEFAULT_DELETION_DELAY;

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
    await feedbackRepo.createFeedback(operationId, feedbackMessageId, scheduledDeletion);

    console.log('Feedback posted:', {
      chatId,
      feedbackMessageId,
      operationId,
      scheduledDeletion,
    });

    return {
      messageId: feedbackMessageId,
      chatId,
      scheduledDeletion,
    };
  } catch (error) {
    console.error('Failed to post feedback:', {
      chatId,
      replyToMessageId,
      operationId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Delete a feedback message immediately
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

    // Remove from database
    const feedbackRepo = new FeedbackRepository();
    await feedbackRepo.deleteFeedback(messageId);

    console.log('Feedback message deleted:', { chatId, messageId });
    return true;
  } catch (error) {
    // Message might already be deleted or not exist
    if (error.response?.error_code === 400) {
      console.log('Feedback message already deleted:', { chatId, messageId });

      // Still remove from database
      const feedbackRepo = new FeedbackRepository();
      await feedbackRepo.deleteFeedback(messageId);

      return true;
    }

    console.error('Failed to delete feedback message:', {
      chatId,
      messageId,
      error: error.message,
    });
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
    console.error('Failed to dismiss feedback:', {
      chatId,
      messageId,
      error: error.message,
    });
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
    console.warn('Bot instance not initialized, skipping scheduled deletions');
    return { processed: 0, deleted: 0, errors: 0 };
  }

  try {
    const feedbackRepo = new FeedbackRepository();
    const scheduled = await feedbackRepo.getScheduledDeletions();

    console.log(`Processing ${scheduled.length} scheduled deletions`);

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
        console.error('Error deleting scheduled feedback:', {
          feedbackId: feedback.id,
          messageId: feedback.feedbackMessageId,
          error: error.message,
        });
        errors++;
      }
    }

    console.log('Scheduled deletions processed:', {
      total: scheduled.length,
      deleted,
      errors,
    });

    return {
      processed: scheduled.length,
      deleted,
      errors,
    };
  } catch (error) {
    console.error('Failed to process scheduled deletions:', error.message);
    return {
      processed: 0,
      deleted: 0,
      errors: 1,
    };
  }
}

/**
 * Start background job for processing scheduled deletions
 * @param {number} [intervalMs] - Check interval in milliseconds (default: 1 minute)
 * @param {TelegrafBot} [botInstance] - Bot instance
 * @returns {NodeJS.Timeout} Interval ID (can be used with clearInterval)
 */
export function startDeletionScheduler(intervalMs = 60000, botInstance = null) {
  console.log(`Starting deletion scheduler (interval: ${intervalMs}ms)`);

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
    console.log('Deletion scheduler stopped');
  }
}
