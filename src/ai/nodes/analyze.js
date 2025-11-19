/**
 * Analyze Node
 * Performs intent classification on the Telegram message
 *
 * Task 4.3.2: Implement Analyze Node
 */

import { classifyIntent } from '../intent-classifier.js';
import { WorkflowStatus } from '../state-schema.js';

/**
 * Analyze node - classifies user intent from Telegram message
 *
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with intent classification
 */
export async function analyzeNode(state) {
  try {
    // Extract message text from Telegram message
    const message = state.telegramMessage?.text || '';

    if (!message) {
      return {
        ...state,
        error: {
          message: 'No message text found in Telegram message',
          code: 'MISSING_MESSAGE_TEXT',
          details: 'Telegram message must contain text to analyze',
        },
        status: WorkflowStatus.ERROR,
        timestamps: {
          ...state.timestamps,
          analyzedAt: Date.now(),
        },
      };
    }

    // Get conversation context if available
    const context = state.conversationContext || [];

    // Extract metadata from Telegram message
    const messageMetadata = {
      userId: state.telegramMessage?.from?.id,
      username: state.telegramMessage?.from?.username,
      chatId: state.telegramMessage?.chat?.id,
      messageId: state.telegramMessage?.message_id,
    };

    // Classify the intent
    const intent = await classifyIntent({
      message,
      context,
      messageMetadata,
    });

    // Update state with classified intent
    return {
      ...state,
      intent,
      status: WorkflowStatus.PROCESSING,
      timestamps: {
        ...state.timestamps,
        analyzedAt: Date.now(),
      },
    };
  } catch (error) {
    console.error('Error in analyze node:', error);

    return {
      ...state,
      error: {
        message: `Intent classification failed: ${error.message}`,
        code: 'INTENT_CLASSIFICATION_ERROR',
        details: error.stack,
      },
      status: WorkflowStatus.ERROR,
      timestamps: {
        ...state.timestamps,
        analyzedAt: Date.now(),
      },
    };
  }
}
