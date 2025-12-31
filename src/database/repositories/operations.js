/**
 * OperationsRepository
 * Manages operation tracking and history for bot actions
 */

import { getDb, ObjectId } from '../db.js';
import logger from '../../utils/logger.js';

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

      const db = await getDb();
      const collection = db.collection('operations');

      const now = new Date();
      const doc = {
        telegramGroupId: Long.fromNumber(telegramGroupId),
        telegramMessageId: Long.fromNumber(telegramMessageId),
        operationType,
        githubIssueUrl,
        operationData,
        status,
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.insertOne(doc);

      return {
        id: result.insertedId.toString(),
        telegramGroupId,
        telegramMessageId,
        operationType,
        githubIssueUrl,
        operationData,
        status,
        createdAt: now,
      };
    } catch (error) {
      logger.error({ err: error, telegramGroupId, telegramMessageId, operationType }, 'Error creating operation');
      throw error;
    }
  }

  /**
   * Update operation status
   * @param {string} operationId - Operation ObjectId string
   * @param {string} status - New status (pending, processing, completed, failed, undone)
   * @param {Object} [metadata] - Optional metadata to merge with operation_data
   * @returns {Promise<Object>} Updated operation
   */
  async updateOperationStatus(operationId, status, metadata = null) {
    try {
      const db = await getDb();
      const collection = db.collection('operations');

      const update = {
        $set: {
          status,
          updatedAt: new Date(),
        },
      };

      // Merge metadata with existing operation_data if provided
      if (metadata) {
        update.$set.operationData = metadata;
      }

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(operationId) },
        update,
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Operation not found: ${operationId}`);
      }

      const operation = result;

      return {
        id: operation._id.toString(),
        telegramGroupId: Number(operation.telegramGroupId),
        telegramMessageId: Number(operation.telegramMessageId),
        operationType: operation.operationType,
        githubIssueUrl: operation.githubIssueUrl,
        operationData: operation.operationData,
        status: operation.status,
        createdAt: operation.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, operationId, status, metadata }, 'Error updating operation status');
      throw error;
    }
  }

  /**
   * Update operation with GitHub issue URL
   * @param {string} operationId - Operation ObjectId string
   * @param {string} githubIssueUrl - GitHub issue URL
   * @returns {Promise<Object>} Updated operation
   */
  async updateGithubIssueUrl(operationId, githubIssueUrl) {
    try {
      const db = await getDb();
      const collection = db.collection('operations');

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(operationId) },
        {
          $set: {
            githubIssueUrl,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Operation not found: ${operationId}`);
      }

      const operation = result;

      return {
        id: operation._id.toString(),
        telegramGroupId: Number(operation.telegramGroupId),
        telegramMessageId: Number(operation.telegramMessageId),
        operationType: operation.operationType,
        githubIssueUrl: operation.githubIssueUrl,
        operationData: operation.operationData,
        status: operation.status,
        createdAt: operation.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, operationId, githubIssueUrl }, 'Error updating GitHub issue URL');
      throw error;
    }
  }

  /**
   * Get operation by ID
   * @param {string} operationId - Operation ObjectId string
   * @returns {Promise<Object|null>} Operation or null if not found
   */
  async getOperationById(operationId) {
    try {
      const db = await getDb();
      const collection = db.collection('operations');

      const operation = await collection.findOne({ _id: new ObjectId(operationId) });

      if (!operation) {
        return null;
      }

      return {
        id: operation._id.toString(),
        telegramGroupId: Number(operation.telegramGroupId),
        telegramMessageId: Number(operation.telegramMessageId),
        operationType: operation.operationType,
        githubIssueUrl: operation.githubIssueUrl,
        operationData: operation.operationData,
        status: operation.status,
        createdAt: operation.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, operationId }, 'Error getting operation by ID');
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
      const db = await getDb();
      const collection = db.collection('operations');

      const operation = await collection
        .find({ telegramMessageId: Long.fromNumber(messageId) })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      if (operation.length === 0) {
        return null;
      }

      const op = operation[0];

      return {
        id: op._id.toString(),
        telegramGroupId: Number(op.telegramGroupId),
        telegramMessageId: Number(op.telegramMessageId),
        operationType: op.operationType,
        githubIssueUrl: op.githubIssueUrl,
        operationData: op.operationData,
        status: op.status,
        createdAt: op.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, messageId }, 'Error getting operation by message ID');
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
      const db = await getDb();
      const collection = db.collection('operations');

      const operations = await collection
        .find({ telegramGroupId: Long.fromNumber(groupId) })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return operations.map(operation => ({
        id: operation._id.toString(),
        telegramGroupId: Number(operation.telegramGroupId),
        telegramMessageId: Number(operation.telegramMessageId),
        operationType: operation.operationType,
        githubIssueUrl: operation.githubIssueUrl,
        operationData: operation.operationData,
        status: operation.status,
        createdAt: operation.createdAt,
      }));
    } catch (error) {
      logger.error({ err: error, groupId, limit }, 'Error getting group operation history');
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
      const db = await getDb();
      const collection = db.collection('operations');

      const operations = await collection
        .find({ status })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return operations.map(operation => ({
        id: operation._id.toString(),
        telegramGroupId: Number(operation.telegramGroupId),
        telegramMessageId: Number(operation.telegramMessageId),
        operationType: operation.operationType,
        githubIssueUrl: operation.githubIssueUrl,
        operationData: operation.operationData,
        status: operation.status,
        createdAt: operation.createdAt,
      }));
    } catch (error) {
      logger.error({ err: error, status, limit }, 'Error getting operations by status');
      throw error;
    }
  }

  /**
   * Delete operation
   * @param {string} operationId - Operation ObjectId string
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteOperation(operationId) {
    try {
      const db = await getDb();
      const collection = db.collection('operations');

      const result = await collection.deleteOne({ _id: new ObjectId(operationId) });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error({ err: error, operationId }, 'Error deleting operation');
      throw error;
    }
  }
}

// Helper to convert number to Long (MongoDB's 64-bit integer type)
const Long = {
  fromNumber: (num) => num,
};

// Export singleton instance
export default new OperationsRepository();
