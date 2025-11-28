/**
 * Store Node
 * Stores operation record in the database
 *
 * Task 4.3.8: Implement Store Node
 */

import { OperationsRepository } from '../../database/repositories/operations.js';
import { WorkflowStatus } from '../state-schema.js';
import logger from '../../utils/logger.js';

/**
 * Store node - records the operation in the database
 *
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with operation ID
 */
export async function storeNode(state) {
  try {
    const { telegramMessage, intent, githubOperation, result } = state;

    // Create operation record
    const operationData = {
      telegramGroupId: telegramMessage?.chat?.id,
      telegramMessageId: telegramMessage?.message_id,
      operationType: githubOperation?.type || intent?.intent || 'unknown',
      githubIssueUrl: result?.issueUrl || null,
      operationData: {
        userId: telegramMessage?.from?.id,
        intentType: intent?.intent,
        confidence: intent?.confidence,
        githubIssueNumber: result?.issueNumber || null,
        title: githubOperation?.data?.title,
        labels: githubOperation?.data?.labels,
        assignees: githubOperation?.data?.assignees,
      },
      status: result?.success ? 'completed' : 'pending',
    };

    const operationsRepo = new OperationsRepository();
    const operation = await operationsRepo.createOperation(operationData);

    return {
      ...state,
      operationId: operation.id,
      timestamps: {
        ...state.timestamps,
        executedAt: Date.now(),
      },
    };
  } catch (error) {
    logger.error({
      err: error,
      chatId: state.telegramMessage?.chat?.id,
      messageId: state.telegramMessage?.message_id,
      operationType: state.githubOperation?.type,
    }, 'Error in store node');

    // Don't fail the workflow if storage fails
    // Log the error and continue to notify
    return {
      ...state,
      error: {
        message: `Failed to store operation: ${error.message}`,
        code: 'STORAGE_ERROR',
        details: error.stack,
      },
      timestamps: {
        ...state.timestamps,
        executedAt: Date.now(),
      },
    };
  }
}
