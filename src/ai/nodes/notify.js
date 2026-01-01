/**
 * Notify Node
 * Sends feedback to Telegram with reaction updates
 *
 * Task 4.3.9: Implement Notify Node
 */

import { escapeMarkdownV1 } from 'telegram-escape';
import { setReaction } from '../../services/telegram/reactions.js';
import { postFeedback } from '../../services/telegram/feedback.js';
import { WorkflowStatus, IntentType } from '../state-schema.js';
import logger from '../../utils/logger.js';

/**
 * Gets the appropriate emoji based on intent type
 *
 * @param {string} intentType - Intent type
 * @returns {string} Emoji reaction
 */
function getSuccessEmoji(intentType) {
  switch (intentType) {
    case IntentType.CREATE_BUG:
      return '👾'; // Bug recorded
    case IntentType.CREATE_TASK:
      return '🫡'; // Task issued
    case IntentType.CREATE_IDEA:
      return '🦄'; // Idea logged
    default:
      return '👌'; // Generic success (processing complete)
  }
}

/**
 * Formats feedback message for the user
 *
 * @param {Object} state - Workflow state
 * @returns {string} Formatted feedback message
 */
function formatFeedbackMessage(state) {
  const { intent, result, githubOperation } = state;

  // Success case
  if (result?.success && result?.issueUrl) {
    const emoji = getSuccessEmoji(intent.intent);
    return `${emoji} Issue created successfully!\n\n📎 ${escapeMarkdownV1(result.issueUrl)}`;
  }

  // Error case (GitHub operation failed)
  if (result && !result.success && githubOperation?.data) {
    const { title } = githubOperation.data;
    const errorMsg = result.error || 'Unknown error';
    return `❌ Failed to create issue: "${escapeMarkdownV1(title)}"\n\nError: ${escapeMarkdownV1(errorMsg)}`;
  }

  // Unknown intent case
  if (intent.intent === IntentType.UNKNOWN) {
    return `🤷 I couldn't determine what action you want me to take.\n\nTry being more specific, or use keywords like "bug", "task", or "feature idea".`;
  }

  // Low confidence case
  if (intent.confidence < 0.5) {
    const confidence = Math.round(intent.confidence * 100);
    return `🤔 I'm not very confident about this request (${confidence}%).\n\nCould you rephrase or add more details?`;
  }

  // Default case
  const confidence = Math.round(intent.confidence * 100);
  return `👌 Message analyzed successfully.\n\nIntent: ${escapeMarkdownV1(intent.intent)}\nConfidence: ${confidence}%`;
}

/**
 * Notify node - sends Telegram feedback and updates reactions
 *
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with completion timestamp
 */
export async function notifyNode(state) {
  try {
    const { telegramMessage, intent, result } = state;
    const chatId = telegramMessage?.chat?.id;
    const messageId = telegramMessage?.message_id;

    if (!chatId || !messageId) {
      throw new Error('Missing chat ID or message ID for notification');
    }

    // Update reaction to success emoji
    const emoji = result?.success
      ? getSuccessEmoji(intent.intent)
      : (intent.intent === IntentType.UNKNOWN ? '🤷' : '👌');

    await setReaction(chatId, messageId, emoji);

    // Post feedback message
    const feedbackMessage = formatFeedbackMessage(state);
    const feedbackMessageId = await postFeedback(chatId, messageId, feedbackMessage, state.operationId);

    return {
      ...state,
      status: WorkflowStatus.COMPLETED,
      timestamps: {
        ...state.timestamps,
        completedAt: Date.now(),
      },
      feedbackMessageId,
    };
  } catch (error) {
    logger.error({
      err: error,
      chatId: state.telegramMessage?.chat?.id,
      messageId: state.telegramMessage?.message_id,
    }, 'Error in notify node');

    // Notification failure shouldn't fail the whole workflow
    return {
      ...state,
      status: WorkflowStatus.COMPLETED,
      error: {
        ...state.error,
        notificationError: error.message,
      },
      timestamps: {
        ...state.timestamps,
        completedAt: Date.now(),
      },
    };
  }
}
