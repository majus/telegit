/**
 * ConversationContextRepository
 * Manages conversation thread caching with TTL expiration
 */

import { query, getClient } from '../db.js';

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
    try {
      const {
        telegramGroupId,
        threadRootMessageId,
        messagesChain,
        ttlMinutes = 60,
      } = data;

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
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      const result = await query(
        `INSERT INTO conversation_context (
          telegram_group_id,
          thread_root_message_id,
          messages_chain,
          expires_at
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (telegram_group_id, thread_root_message_id)
        DO UPDATE SET
          messages_chain = EXCLUDED.messages_chain,
          cached_at = CURRENT_TIMESTAMP,
          expires_at = EXCLUDED.expires_at
        RETURNING *`,
        [telegramGroupId, threadRootMessageId, JSON.stringify(messagesChain), expiresAt]
      );

      const context = result.rows[0];

      return {
        id: context.id,
        telegramGroupId: context.telegram_group_id,
        threadRootMessageId: context.thread_root_message_id,
        messagesChain: context.messages_chain,
        cachedAt: context.cached_at,
        expiresAt: context.expires_at,
      };
    } catch (error) {
      console.error('Error caching context:', error.message);
      throw error;
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
      const result = await query(
        `SELECT * FROM conversation_context
         WHERE telegram_group_id = $1
         AND thread_root_message_id = $2
         AND expires_at > CURRENT_TIMESTAMP`,
        [groupId, threadRootMessageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const context = result.rows[0];

      return {
        id: context.id,
        telegramGroupId: context.telegram_group_id,
        threadRootMessageId: context.thread_root_message_id,
        messagesChain: context.messages_chain,
        cachedAt: context.cached_at,
        expiresAt: context.expires_at,
      };
    } catch (error) {
      console.error('Error getting context:', error.message);
      throw error;
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
      const result = await query(
        `SELECT 1 FROM conversation_context
         WHERE telegram_group_id = $1
         AND thread_root_message_id = $2
         AND expires_at > CURRENT_TIMESTAMP`,
        [groupId, threadRootMessageId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking context validity:', error.message);
      throw error;
    }
  }

  /**
   * Delete expired context entries
   * Should be called periodically for cleanup
   * @returns {Promise<number>} Number of records deleted
   */
  async invalidateExpiredContexts() {
    try {
      const result = await query(
        `DELETE FROM conversation_context
         WHERE expires_at <= CURRENT_TIMESTAMP`
      );

      if (result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} expired context entries`);
      }

      return result.rowCount;
    } catch (error) {
      console.error('Error invalidating expired contexts:', error.message);
      throw error;
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
      const result = await query(
        `DELETE FROM conversation_context
         WHERE telegram_group_id = $1
         AND thread_root_message_id = $2`,
        [groupId, threadRootMessageId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting context:', error.message);
      throw error;
    }
  }

  /**
   * Delete all context for a group
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<number>} Number of records deleted
   */
  async deleteGroupContexts(groupId) {
    try {
      const result = await query(
        `DELETE FROM conversation_context
         WHERE telegram_group_id = $1`,
        [groupId]
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error deleting group contexts:', error.message);
      throw error;
    }
  }

  /**
   * Get all cached contexts for a group (including expired)
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<Array>} List of context records
   */
  async getGroupContexts(groupId) {
    try {
      const result = await query(
        `SELECT * FROM conversation_context
         WHERE telegram_group_id = $1
         ORDER BY cached_at DESC`,
        [groupId]
      );

      return result.rows.map(context => ({
        id: context.id,
        telegramGroupId: context.telegram_group_id,
        threadRootMessageId: context.thread_root_message_id,
        messagesChain: context.messages_chain,
        cachedAt: context.cached_at,
        expiresAt: context.expires_at,
      }));
    } catch (error) {
      console.error('Error getting group contexts:', error.message);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Statistics about cached contexts
   */
  async getCacheStats() {
    try {
      const result = await query(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE expires_at > CURRENT_TIMESTAMP) as valid,
          COUNT(*) FILTER (WHERE expires_at <= CURRENT_TIMESTAMP) as expired
         FROM conversation_context`
      );

      const stats = result.rows[0];

      return {
        total: parseInt(stats.total, 10),
        valid: parseInt(stats.valid, 10),
        expired: parseInt(stats.expired, 10),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error.message);
      throw error;
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

      const result = await query(
        `UPDATE conversation_context
         SET expires_at = $3
         WHERE telegram_group_id = $1
         AND thread_root_message_id = $2
         RETURNING *`,
        [groupId, threadRootMessageId, expiresAt]
      );

      if (result.rows.length === 0) {
        throw new Error(`Context not found for group ${groupId}, thread ${threadRootMessageId}`);
      }

      const context = result.rows[0];

      return {
        id: context.id,
        telegramGroupId: context.telegram_group_id,
        threadRootMessageId: context.thread_root_message_id,
        messagesChain: context.messages_chain,
        cachedAt: context.cached_at,
        expiresAt: context.expires_at,
      };
    } catch (error) {
      console.error('Error updating TTL:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new ConversationContextRepository();
