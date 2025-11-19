/**
 * AI Message Processor
 * Main entry point for AI-powered message processing
 *
 * Task 4.4.1: Implement Message Processor
 */

import { executeWorkflow, getWorkflowStats } from './workflow.js';
import { createInitialState } from './state-schema.js';
import { getGroupConfig } from '../database/repositories/config.js';
import { getConversationContext } from '../services/telegram/thread-context.js';
import logger from '../utils/logger.js';

/**
 * Processes a Telegram message through the AI workflow
 *
 * @param {Object} telegramMessage - Telegram message object
 * @param {Object} options - Processing options
 * @param {boolean} [options.skipContextGathering] - Skip conversation context gathering
 * @returns {Promise<Object>} Workflow result with statistics
 * @throws {Error} If processing fails critically
 */
export async function processMessage(telegramMessage, options = {}) {
  const startTime = Date.now();

  try {
    // Validate input
    if (!telegramMessage) {
      throw new Error('Telegram message is required');
    }

    if (!telegramMessage.chat?.id) {
      throw new Error('Message must have a chat ID');
    }

    // Get group configuration
    const groupId = telegramMessage.chat.id;
    const groupConfig = await getGroupConfig(groupId);

    if (!groupConfig) {
      throw new Error(
        `No configuration found for group ${groupId}. ` +
        'Please set up GitHub authentication first using the /setup command.'
      );
    }

    // Gather conversation context if message is a reply
    let conversationContext = null;
    if (!options.skipContextGathering && telegramMessage.reply_to_message) {
      try {
        conversationContext = await getConversationContext(
          telegramMessage.chat.id,
          telegramMessage.message_id
        );
      } catch (error) {
        logger.warn({ err: error, chatId: telegramMessage.chat.id, messageId: telegramMessage.message_id }, 'Failed to gather conversation context');
        // Continue without context - not critical
      }
    }

    // Create initial workflow state
    const initialState = createInitialState(telegramMessage, groupConfig);
    initialState.conversationContext = conversationContext;

    // Execute workflow
    const result = await executeWorkflow(initialState);

    // Get workflow statistics
    const stats = getWorkflowStats(result);

    // Log processing metrics
    logger.info({
      chatId: groupId,
      messageId: telegramMessage.message_id,
      intent: stats.intent,
      confidence: stats.confidence,
      totalDuration: stats.totalDuration,
      success: stats.success,
    }, 'Message processing completed');

    return {
      success: stats.success,
      result,
      stats,
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    logger.error({
      err: error,
      chatId: telegramMessage?.chat?.id,
      messageId: telegramMessage?.message_id,
    }, 'Critical error in message processor');

    throw error;
  }
}

/**
 * Batch processes multiple messages
 * Useful for testing and evaluation
 *
 * @param {Object[]} messages - Array of Telegram messages
 * @param {Object} options - Processing options
 * @returns {Promise<Object[]>} Array of processing results
 */
export async function batchProcessMessages(messages, options = {}) {
  const results = await Promise.allSettled(
    messages.map(message => processMessage(message, options))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        messageIndex: index,
        success: true,
        ...result.value,
      };
    } else {
      return {
        messageIndex: index,
        success: false,
        error: result.reason.message,
      };
    }
  });
}

/**
 * Gets processor health status
 * Used for health checks and monitoring
 *
 * @returns {Promise<Object>} Health status
 */
export async function getProcessorHealth() {
  try {
    // Test database connection
    const dbHealthy = await testDatabaseConnection();

    // Test LLM connection (if needed)
    // const llmHealthy = await validateLLMConnection(getDefaultLLMClient());

    return {
      healthy: dbHealthy,
      components: {
        database: dbHealthy,
        // llm: llmHealthy,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

/**
 * Tests database connection
 *
 * @returns {Promise<boolean>} True if database is healthy
 */
async function testDatabaseConnection() {
  try {
    // Simple query to test connection
    const { query } = await import('../database/db.js');
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Database health check failed');
    return false;
  }
}
