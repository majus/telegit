/**
 * ConversationContextRepository
 * Manages conversation thread caching with TTL expiration
 */

import { getDb, ObjectId, Long } from '../db.js';
import logger from '../../utils/logger.js';

/**
 * Repository for managing conversation context cache
 */
export class ConversationContextRepository {
  /**
   * Cache conversation context for a thread
   * @param {Object} data - Context data
   * @param {number} data.telegramGroupId - Telegram group ID
   * @param {number} data.threadRootMessageId - Root message ID of the thread
   * @param {Array} data.messagesChain - Array of messages in the thread
   * @param {number} [data.ttlMinutes=60] - Time to live in minutes (default 60)
   * @returns {Promise<Object>} Created context record
   */
  async cacheContext(data) {
    const {
      telegramGroupId,
      threadRootMessageId,
      messagesChain,
      ttlMinutes = 60,
    } = data;
    try {

      // Validate required fields
      if (!telegramGroupId || !threadRootMessageId || !messagesChain) {
        throw new Error('Missing required fields: telegramGroupId, threadRootMessageId, messagesChain');
      }

      if (!Array.isArray(messagesChain)) {
        throw new Error('messagesChain must be an array');
      }

      // Validate TTL bounds
      if (typeof ttlMinutes !== 'number' || ttlMinutes < 1 || ttlMinutes > 10080) {
        throw new Error('ttlMinutes must be a number between 1 and 10080 (7 days)');
      }

      // Calculate expiration time
      const now = new Date();
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      const db = await getDb();
      const collection = db.collection('conversation_context');

      const result = await collection.findOneAndUpdate(
        {
          telegramGroupId: Long.fromNumber(telegramGroupId),
          threadRootMessageId: Long.fromNumber(threadRootMessageId),
        },
        {
          $set: {
            messagesChain,
            expiresAt,
            updatedAt: now,
          },
          $setOnInsert: {
            telegramGroupId: Long.fromNumber(telegramGroupId),
            threadRootMessageId: Long.fromNumber(threadRootMessageId),
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      const context = result;

      return {
        id: context._id.toString(),
        telegramGroupId: Number(context.telegramGroupId),
        threadRootMessageId: Number(context.threadRootMessageId),
        messagesChain: context.messagesChain,
        createdAt: context.createdAt,
        expiresAt: context.expiresAt,
      };
    } catch (err) {
      logger.error({ err, telegramGroupId, threadRootMessageId }, 'Error caching context');
      throw err;
    }
  }

  /**
   * Get cached context for a thread
   * Returns null if not found or expired
   * @param {number} groupId - Telegram group ID
   * @param {number} threadRootMessageId - Root message ID of the thread
   * @returns {Promise<Object|null>} Context record or null
   */
  async getContext(groupId, threadRootMessageId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const context = await collection.findOne({
        telegramGroupId: Long.fromNumber(groupId),
        threadRootMessageId: Long.fromNumber(threadRootMessageId),
        expiresAt: { $gt: new Date() },
      });

      if (!context) {
        return null;
      }

      return {
        id: context._id.toString(),
        telegramGroupId: Number(context.telegramGroupId),
        threadRootMessageId: Number(context.threadRootMessageId),
        messagesChain: context.messagesChain,
        createdAt: context.createdAt,
        expiresAt: context.expiresAt,
      };
    } catch (err) {
      logger.error({ err, groupId, threadRootMessageId }, 'Error getting context');
      throw err;
    }
  }

  /**
   * Check if context exists and is not expired
   * @param {number} groupId - Telegram group ID
   * @param {number} threadRootMessageId - Root message ID of the thread
   * @returns {Promise<boolean>} True if valid context exists
   */
  async hasValidContext(groupId, threadRootMessageId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const count = await collection.countDocuments({
        telegramGroupId: Long.fromNumber(groupId),
        threadRootMessageId: Long.fromNumber(threadRootMessageId),
        expiresAt: { $gt: new Date() },
      });

      return count > 0;
    } catch (err) {
      logger.error({ err, groupId, threadRootMessageId }, 'Error checking context validity');
      throw err;
    }
  }

  /**
   * Delete expired context entries
   * Should be called periodically for cleanup
   * @returns {Promise<number>} Number of records deleted
   */
  async invalidateExpiredContexts() {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const result = await collection.deleteMany({
        expiresAt: { $lte: new Date() },
      });

      if (result.deletedCount > 0) {
        logger.info({ count: result.deletedCount }, 'Cleaned up expired context entries');
      }

      return result.deletedCount;
    } catch (err) {
      logger.error({ err }, 'Error invalidating expired contexts');
      throw err;
    }
  }

  /**
   * Delete context for a specific thread
   * @param {number} groupId - Telegram group ID
   * @param {number} threadRootMessageId - Root message ID of the thread
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteContext(groupId, threadRootMessageId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const result = await collection.deleteOne({
        telegramGroupId: Long.fromNumber(groupId),
        threadRootMessageId: Long.fromNumber(threadRootMessageId),
      });

      return result.deletedCount > 0;
    } catch (err) {
      logger.error({ err, groupId, threadRootMessageId }, 'Error deleting context');
      throw err;
    }
  }

  /**
   * Delete all context for a group
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteGroupContexts(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const result = await collection.deleteMany({
        telegramGroupId: Long.fromNumber(groupId),
      });

      return result.deletedCount;
    } catch (err) {
      logger.error({ err, groupId }, 'Error deleting group contexts');
      throw err;
    }
  }

  /**
   * Get all cached contexts for a group (including expired)
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<Array>} List of context records
   */
  async getGroupContexts(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const contexts = await collection
        .find({ telegramGroupId: Long.fromNumber(groupId) })
        .sort({ createdAt: -1 })
        .toArray();

      return contexts.map(context => ({
        id: context._id.toString(),
        telegramGroupId: Number(context.telegramGroupId),
        threadRootMessageId: Number(context.threadRootMessageId),
        messagesChain: context.messagesChain,
        createdAt: context.createdAt,
        expiresAt: context.expiresAt,
      }));
    } catch (err) {
      logger.error({ err, groupId }, 'Error getting group contexts');
      throw err;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Statistics about cached contexts
   */
  async getCacheStats() {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const now = new Date();
      const result = await collection.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            valid: {
              $sum: {
                $cond: [{ $gt: ['$expiresAt', now] }, 1, 0],
              },
            },
            expired: {
              $sum: {
                $cond: [{ $lte: ['$expiresAt', now] }, 1, 0],
              },
            },
          },
        },
      ]).toArray();

      if (result.length === 0) {
        return { total: 0, valid: 0, expired: 0 };
      }

      const stats = result[0];

      return {
        total: stats.total,
        valid: stats.valid,
        expired: stats.expired,
      };
    } catch (err) {
      logger.error({ err }, 'Error getting cache stats');
      throw err;
    }
  }

  /**
   * Update TTL for an existing context
   * @param {number} groupId - Telegram group ID
   * @param {number} threadRootMessageId - Root message ID of the thread
   * @param {number} ttlMinutes - New TTL in minutes
   * @returns {Promise<Object>} Updated context record
   */
  async updateTTL(groupId, threadRootMessageId, ttlMinutes) {
    try {
      // Validate TTL bounds
      if (typeof ttlMinutes !== 'number' || ttlMinutes < 1 || ttlMinutes > 10080) {
        throw new Error('ttlMinutes must be a number between 1 and 10080 (7 days)');
      }

      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      const db = await getDb();
      const collection = db.collection('conversation_context');

      const result = await collection.findOneAndUpdate(
        {
          telegramGroupId: Long.fromNumber(groupId),
          threadRootMessageId: Long.fromNumber(threadRootMessageId),
        },
        { $set: { expiresAt, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Context not found for group ${groupId}, thread ${threadRootMessageId}`);
      }

      const context = result;

      return {
        id: context._id.toString(),
        telegramGroupId: Number(context.telegramGroupId),
        threadRootMessageId: Number(context.threadRootMessageId),
        messagesChain: context.messagesChain,
        createdAt: context.createdAt,
        expiresAt: context.expiresAt,
      };
    } catch (err) {
      logger.error({ err, groupId, threadRootMessageId, ttlMinutes }, 'Error updating TTL');
      throw err;
    }
  }

  /**
   * Get count of cached contexts for a group
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<number>} Count of context records
   */
  async getContextCountByGroup(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('conversation_context');

      const count = await collection.countDocuments({
        telegramGroupId: Long.fromNumber(groupId),
        expiresAt: { $gt: new Date() },
      });

      return count;
    } catch (err) {
      logger.error({ err, groupId }, 'Error getting context count by group');
      throw err;
    }
  }
}

// Export singleton instance
export default new ConversationContextRepository();
