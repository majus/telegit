/**
 * Error Handler Node
 * Handles errors in the workflow and sends error feedback
 *
 * Task 4.3.10: Implement Error Handler Node
 */

import { setReaction } from '../../services/telegram/reactions.js';
import { postFeedback } from '../../services/telegram/feedback.js';
import { WorkflowStatus } from '../state-schema.js';
import logger from '../../utils/logger.js';

/**
 * Formats user-friendly error message
 *
 * @param {Object} error - Error object
 * @returns {string} Formatted error message
 */
function formatErrorMessage(error) {
  if (!error) {
    return '😵‍💫 An unexpected error occurred.';
  }

  // Map error codes to user-friendly messages
  const errorMessages = {
    MISSING_MESSAGE_TEXT: '❌ No message text found. Please send a text message.',
    INTENT_CLASSIFICATION_ERROR: '😵‍💫 I had trouble understanding your message. Please try rephrasing it.',
    FORMATTING_ERROR: '❌ There was an issue preparing your request.',
    STORAGE_ERROR: '⚠️ Your request was processed but couldn\'t be saved to the database.',
    WORKFLOW_EXECUTION_ERROR: '😵‍💫 Something went wrong while processing your request.',
  };

  const userMessage = errorMessages[error.code] || '😵‍💫 An error occurred while processing your request.';

  // Add detailed error message in development
  const config = process.env.NODE_ENV === 'development'
    ? `\n\n🔍 Details: ${error.message}`
    : '';

  return userMessage + config;
}

/**
 * Error handler node - handles workflow errors gracefully
 *
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with error handling
 */
export async function errorNode(state) {
  try {
    const { telegramMessage, error } = state;
    const chatId = telegramMessage?.chat?.id;
    const messageId = telegramMessage?.message_id;

    if (!chatId || !messageId) {
      logger.error({ err: error }, 'Cannot send error notification - missing chat/message ID');
      return {
        ...state,
        status: WorkflowStatus.ERROR,
        timestamps: {
          ...state.timestamps,
          completedAt: Date.now(),
        },
      };
    }

    // Update reaction to error emoji
    await setReaction(chatId, messageId, '😱');

    // Post error feedback
    const errorMessage = formatErrorMessage(error);
    const feedbackMessageId = await postFeedback(chatId, messageId, errorMessage);

    // Log detailed error for debugging
    logger.error({
      code: error?.code,
      message: error?.message,
      details: error?.details,
      chatId,
      messageId,
    }, 'Workflow error');

    return {
      ...state,
      status: WorkflowStatus.ERROR,
      timestamps: {
        ...state.timestamps,
        completedAt: Date.now(),
      },
      feedbackMessageId,
    };
  } catch (notificationError) {
    logger.error({
      err: notificationError,
      chatId: state.telegramMessage?.chat?.id,
      messageId: state.telegramMessage?.message_id,
    }, 'Error in error handler node');

    // Even error handling failed - just log and return error state
    return {
      ...state,
      status: WorkflowStatus.ERROR,
      error: {
        ...state.error,
        notificationError: notificationError.message,
      },
      timestamps: {
        ...state.timestamps,
        completedAt: Date.now(),
      },
    };
  }
}
