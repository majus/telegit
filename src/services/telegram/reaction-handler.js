/**
 * User reaction handler for undo and dismiss actions
 * Handles user control reactions on feedback messages
 */

import { parseReactionUpdate, isUndoReaction, isDismissReaction } from './reactions.js';
import { dismissFeedback } from './feedback.js';
import { FeedbackRepository } from '../../database/repositories/feedback.js';
import { OperationsRepository } from '../../database/repositories/operations.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('telegraf').Context} Context
 */

/**
 * Handle message reaction updates (user adding/removing reactions)
 * @param {Context} ctx - Telegraf context with message_reaction update
 * @param {Function} [undoOperationFn] - Function to undo GitHub operations
 * @returns {Promise<void>}
 */
export async function handleReaction(ctx, undoOperationFn = null) {
  const reactionUpdate = ctx.messageReaction || ctx.update.message_reaction;

  if (!reactionUpdate) {
    return;
  }

  const parsed = parseReactionUpdate(reactionUpdate);

  logger.debug({
    chatId: parsed.chatId,
    messageId: parsed.messageId,
    userId: parsed.userId,
    addedReactions: parsed.addedReactions,
    removedReactions: parsed.removedReactions,
  }, 'Reaction update received');

  // Check if this is a feedback message
  const feedbackRepo = new FeedbackRepository();
  const feedback = await feedbackRepo.getFeedbackByMessageId(parsed.messageId);

  if (!feedback) {
    // Not a feedback message, ignore
    return;
  }

  logger.debug({
    feedbackId: feedback.id,
    operationId: feedback.operationId,
  }, 'Reaction on feedback message');

  // Handle undo reaction (👎)
  if (parsed.addedReactions.some(isUndoReaction)) {
    await handleUndoReaction(ctx, feedback, parsed.userId, undoOperationFn);
  }

  // Handle dismiss reaction (👍)
  if (parsed.addedReactions.some(isDismissReaction)) {
    await handleDismissReaction(ctx, feedback, parsed.userId);
  }
}

/**
 * Handle undo reaction on feedback message
 * Reverts the GitHub operation associated with the feedback
 * @param {Context} ctx - Telegraf context
 * @param {Object} feedback - Feedback record from database
 * @param {number} userId - User who added the reaction
 * @param {Function} undoOperationFn - Function to undo the operation
 * @returns {Promise<void>}
 */
async function handleUndoReaction(ctx, feedback, userId, undoOperationFn) {
  logger.info({
    feedbackId: feedback.id,
    operationId: feedback.operationId,
    userId,
  }, 'Processing undo reaction');

  try {
    // Get the operation
    const operationsRepo = new OperationsRepository();
    const operation = await operationsRepo.getOperationById(feedback.operationId);

    if (!operation) {
      logger.error({ operationId: feedback.operationId }, 'Operation not found for undo');
      await ctx.reply('❌ Could not find the operation to undo.');
      return;
    }

    // Check if operation can be undone
    if (operation.status === 'undone') {
      await ctx.reply('ℹ️ This operation has already been undone.');
      return;
    }

    if (operation.status !== 'completed') {
      await ctx.reply('ℹ️ This operation cannot be undone (it did not complete successfully).');
      return;
    }

    // Check if user is authorized to undo (operation creator or group manager)
    if (operation.telegramUserId !== userId) {
      // For now, allow anyone in the group to undo
      // In production, you might want to restrict this
      logger.debug({ operationUserId: operation.telegramUserId, requestingUserId: userId }, 'Undo requested by different user than operation creator');
    }

    // Perform undo operation
    if (undoOperationFn) {
      try {
        await undoOperationFn(operation);

        // Update operation status
        await operationsRepo.updateOperationStatus(operation.id, 'undone', {
          undoneBy: userId,
          undoneAt: new Date(),
        });

        // Send confirmation
        await ctx.telegram.sendMessage(
          feedback.chatId,
          `✅ Operation undone successfully.

The GitHub issue has been closed with an "Undone by TeleGit" comment.`,
          {
            reply_to_message_id: operation.telegramMessageId,
          }
        );

        // Delete the feedback message
        await dismissFeedback(feedback.chatId, feedback.feedbackMessageId);
      } catch (error) {
        logger.error({ err: error, operationId: operation.id }, 'Failed to undo operation');

        await ctx.telegram.sendMessage(
          feedback.chatId,
          `❌ Failed to undo operation: ${error.message}`,
          {
            reply_to_message_id: operation.telegramMessageId,
          }
        );
      }
    } else {
      logger.warn('No undo operation function provided');
      await ctx.reply('❌ Undo functionality is not configured.');
    }
  } catch (error) {
    logger.error({ err: error }, 'Error handling undo reaction');
    await ctx.reply('❌ An error occurred while processing the undo request.');
  }
}

/**
 * Handle dismiss reaction on feedback message
 * Immediately deletes the feedback message
 * @param {Context} ctx - Telegraf context
 * @param {Object} feedback - Feedback record from database
 * @param {number} userId - User who added the reaction
 * @returns {Promise<void>}
 */
async function handleDismissReaction(ctx, feedback, userId) {
  logger.debug({
    feedbackId: feedback.id,
    userId,
  }, 'Processing dismiss reaction');

  try {
    // Dismiss (delete) the feedback message
    const success = await dismissFeedback(feedback.chatId, feedback.feedbackMessageId);

    if (success) {
      logger.debug({ feedbackMessageId: feedback.feedbackMessageId }, 'Feedback dismissed successfully');
    } else {
      logger.warn({ feedbackMessageId: feedback.feedbackMessageId }, 'Failed to dismiss feedback');
    }
  } catch (error) {
    logger.error({ err: error }, 'Error handling dismiss reaction');
  }
}

/**
 * Create Telegraf middleware for handling reactions
 * @param {Function} undoOperationFn - Function to undo GitHub operations
 * @returns {Function} Telegraf middleware
 */
export function createReactionHandler(undoOperationFn = null) {
  return async (ctx) => {
    await handleReaction(ctx, undoOperationFn);
  };
}

/**
 * Mock undo function for testing
 * In production, this should call GitHub MCP to close/revert the issue
 * @param {Object} operation - Operation to undo
 * @returns {Promise<void>}
 */
export async function mockUndoOperation(operation) {
  logger.debug({
    operationId: operation.id,
    type: operation.operationType,
    githubUrl: operation.githubIssueUrl,
  }, 'Mock undo operation');

  // In production, this would:
  // 1. Use GitHub MCP to close the issue
  // 2. Add a comment "Undone by TeleGit"
  // 3. Update any other related state

  // Simulate async operation
  await new Promise((resolve) => setTimeout(resolve, 1000));

  logger.debug('Mock undo completed');
}
