/**
 * Notify Node
 * Sends feedback to Telegram with reaction updates
 *
 * Task 4.3.9: Implement Notify Node
 */

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
      return '✅'; // Generic success
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
    return `${emoji} Issue created successfully!\n\n📎 ${result.issueUrl}`;
  }

  // Pending case (GitHub operation prepared but not executed yet)
  if (githubOperation && githubOperation.data) {
    const { title } = githubOperation.data;
    return `🔄 Prepared issue: "${title}"\n\n⏳ GitHub integration will be completed in Phase 5.`;
  }

  // Unknown intent case
  if (intent.intent === IntentType.UNKNOWN) {
    return `❓ I couldn't determine what action you want me to take.\n\nTry being more specific, or use keywords like "bug", "task", or "feature idea".`;
  }

  // Low confidence case
  if (intent.confidence < 0.5) {
    return `🤔 I'm not very confident about this request (${Math.round(intent.confidence * 100)}%).\n\nCould you rephrase or add more details?`;
  }

  // Default case
  return `✅ Message analyzed successfully.\n\nIntent: ${intent.intent}\nConfidence: ${Math.round(intent.confidence * 100)}%`;
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
      : (intent.intent === IntentType.UNKNOWN ? '❓' : '✅');

    await setReaction(chatId, messageId, emoji);

    // Post feedback message
    const feedbackMessage = formatFeedbackMessage(state);
    const feedbackMessageId = await postFeedback(chatId, messageId, feedbackMessage);

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
