/**
 * OperationsRepository
 * Manages operation tracking and history for bot actions
 */

import { query, getClient } from '../db.js';

/**
 * Repository for managing operations
 */
export class OperationsRepository {
  /**
   * Create a new operation record
   * @param {Object} data - Operation data
   * @param {number} data.telegramGroupId - Telegram group ID
   * @param {number} data.telegramMessageId - Telegram message ID
   * @param {string} data.operationType - Type of operation (create_bug, create_task, etc.)
   * @param {string} [data.githubIssueUrl] - GitHub issue URL (if available)
   * @param {Object} [data.operationData={}] - Additional operation data
   * @param {string} [data.status='pending'] - Operation status
   * @returns {Promise<Object>} Created operation
   */
  async createOperation(data) {
    try {
      const {
        telegramGroupId,
        telegramMessageId,
        operationType,
        githubIssueUrl = null,
        operationData = {},
        status = 'pending',
      } = data;

      // Validate required fields
      if (!telegramGroupId || !telegramMessageId || !operationType) {
        throw new Error('Missing required fields: telegramGroupId, telegramMessageId, operationType');
      }

      const result = await query(
        `INSERT INTO operations (
          telegram_group_id,
          telegram_message_id,
          operation_type,
          github_issue_url,
          operation_data,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          telegramGroupId,
          telegramMessageId,
          operationType,
          githubIssueUrl,
          JSON.stringify(operationData),
          status,
        ]
      );

      const operation = result.rows[0];

      return {
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      };
    } catch (error) {
      console.error('Error creating operation:', error.message);
      throw error;
    }
  }

  /**
   * Update operation status
   * @param {string} operationId - Operation UUID
   * @param {string} status - New status (pending, processing, completed, failed, undone)
   * @returns {Promise<Object>} Updated operation
   */
  async updateOperationStatus(operationId, status) {
    try {
      const result = await query(
        `UPDATE operations
         SET status = $2
         WHERE id = $1
         RETURNING *`,
        [operationId, status]
      );

      if (result.rows.length === 0) {
        throw new Error(`Operation not found: ${operationId}`);
      }

      const operation = result.rows[0];

      return {
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      };
    } catch (error) {
      console.error('Error updating operation status:', error.message);
      throw error;
    }
  }

  /**
   * Update operation with GitHub issue URL
   * @param {string} operationId - Operation UUID
   * @param {string} githubIssueUrl - GitHub issue URL
   * @returns {Promise<Object>} Updated operation
   */
  async updateGithubIssueUrl(operationId, githubIssueUrl) {
    try {
      const result = await query(
        `UPDATE operations
         SET github_issue_url = $2
         WHERE id = $1
         RETURNING *`,
        [operationId, githubIssueUrl]
      );

      if (result.rows.length === 0) {
        throw new Error(`Operation not found: ${operationId}`);
      }

      const operation = result.rows[0];

      return {
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      };
    } catch (error) {
      console.error('Error updating GitHub issue URL:', error.message);
      throw error;
    }
  }

  /**
   * Get operation by ID
   * @param {string} operationId - Operation UUID
   * @returns {Promise<Object|null>} Operation or null if not found
   */
  async getOperationById(operationId) {
    try {
      const result = await query(
        'SELECT * FROM operations WHERE id = $1',
        [operationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const operation = result.rows[0];

      return {
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      };
    } catch (error) {
      console.error('Error getting operation by ID:', error.message);
      throw error;
    }
  }

  /**
   * Get operation by Telegram message ID
   * @param {number} messageId - Telegram message ID
   * @returns {Promise<Object|null>} Operation or null if not found
   */
  async getOperationByMessageId(messageId) {
    try {
      const result = await query(
        'SELECT * FROM operations WHERE telegram_message_id = $1 ORDER BY created_at DESC LIMIT 1',
        [messageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const operation = result.rows[0];

      return {
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      };
    } catch (error) {
      console.error('Error getting operation by message ID:', error.message);
      throw error;
    }
  }

  /**
   * Get operation history for a group
   * @param {number} groupId - Telegram group ID
   * @param {number} [limit=50] - Maximum number of operations to return
   * @returns {Promise<Array>} List of operations
   */
  async getGroupOperationHistory(groupId, limit = 50) {
    try {
      const result = await query(
        `SELECT * FROM operations
         WHERE telegram_group_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [groupId, limit]
      );

      return result.rows.map(operation => ({
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      }));
    } catch (error) {
      console.error('Error getting group operation history:', error.message);
      throw error;
    }
  }

  /**
   * Get operations by status
   * @param {string} status - Status to filter by
   * @param {number} [limit=100] - Maximum number of operations to return
   * @returns {Promise<Array>} List of operations
   */
  async getOperationsByStatus(status, limit = 100) {
    try {
      const result = await query(
        `SELECT * FROM operations
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [status, limit]
      );

      return result.rows.map(operation => ({
        id: operation.id,
        telegramGroupId: operation.telegram_group_id,
        telegramMessageId: operation.telegram_message_id,
        operationType: operation.operation_type,
        githubIssueUrl: operation.github_issue_url,
        operationData: operation.operation_data,
        status: operation.status,
        createdAt: operation.created_at,
      }));
    } catch (error) {
      console.error('Error getting operations by status:', error.message);
      throw error;
    }
  }

  /**
   * Delete operation
   * @param {string} operationId - Operation UUID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteOperation(operationId) {
    try {
      const result = await query(
        'DELETE FROM operations WHERE id = $1',
        [operationId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting operation:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new OperationsRepository();
