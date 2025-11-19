/**
 * Store Node
 * Stores operation record in the database
 *
 * Task 4.3.8: Implement Store Node
 */

import { createOperation } from '../../database/repositories/operations.js';
import { WorkflowStatus } from '../state-schema.js';

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
      groupId: telegramMessage?.chat?.id,
      userId: telegramMessage?.from?.id,
      telegramMessageId: telegramMessage?.message_id,
      intentType: intent?.intent,
      confidence: intent?.confidence,
      operationType: githubOperation?.type,
      githubIssueNumber: result?.issueNumber || null,
      githubIssueUrl: result?.issueUrl || null,
      status: result?.success ? 'completed' : 'pending',
      metadata: {
        title: githubOperation?.data?.title,
        labels: githubOperation?.data?.labels,
        assignees: githubOperation?.data?.assignees,
      },
    };

    const operationId = await createOperation(operationData);

    return {
      ...state,
      operationId,
      timestamps: {
        ...state.timestamps,
        executedAt: Date.now(),
      },
    };
  } catch (error) {
    console.error('Error in store node:', error);

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
