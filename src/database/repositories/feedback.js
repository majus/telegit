/**
 * FeedbackRepository
 * Manages feedback messages for auto-deletion and reaction controls
 */

import { query, getClient } from '../db.js';

/**
 * Repository for managing feedback messages
 */
export class FeedbackRepository {
  /**
   * Create a feedback message record
   * @param {Object} data - Feedback data
   * @param {string} data.operationId - Operation UUID
   * @param {number} data.feedbackMessageId - Telegram message ID of the feedback
   * @param {Date|string} data.scheduledDeletion - Timestamp when message should be deleted
   * @returns {Promise<Object>} Created feedback record
   */
  async createFeedback(data) {
    try {
      const { operationId, feedbackMessageId, scheduledDeletion } = data;

      // Validate required fields
      if (!operationId || !feedbackMessageId || !scheduledDeletion) {
        throw new Error('Missing required fields: operationId, feedbackMessageId, scheduledDeletion');
      }

      const result = await query(
        `INSERT INTO operation_feedback (
          operation_id,
          feedback_message_id,
          scheduled_deletion
        )
        VALUES ($1, $2, $3)
        RETURNING *`,
        [operationId, feedbackMessageId, scheduledDeletion]
      );

      const feedback = result.rows[0];

      return {
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      };
    } catch (error) {
      console.error('Error creating feedback:', error.message);
      throw error;
    }
  }

  /**
   * Get feedback by message ID
   * @param {number} messageId - Telegram message ID
   * @returns {Promise<Object|null>} Feedback record or null if not found
   */
  async getFeedbackByMessageId(messageId) {
    try {
      const result = await query(
        'SELECT * FROM operation_feedback WHERE feedback_message_id = $1',
        [messageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const feedback = result.rows[0];

      return {
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      };
    } catch (error) {
      console.error('Error getting feedback by message ID:', error.message);
      throw error;
    }
  }

  /**
   * Get feedback by operation ID
   * @param {string} operationId - Operation UUID
   * @returns {Promise<Object|null>} Feedback record or null if not found
   */
  async getFeedbackByOperationId(operationId) {
    try {
      const result = await query(
        'SELECT * FROM operation_feedback WHERE operation_id = $1',
        [operationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const feedback = result.rows[0];

      return {
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      };
    } catch (error) {
      console.error('Error getting feedback by operation ID:', error.message);
      throw error;
    }
  }

  /**
   * Mark feedback as dismissed (user clicked 👍)
   * @param {number} messageId - Telegram message ID
   * @returns {Promise<Object>} Updated feedback record
   */
  async markDismissed(messageId) {
    try {
      const result = await query(
        `UPDATE operation_feedback
         SET dismissed = TRUE
         WHERE feedback_message_id = $1
         RETURNING *`,
        [messageId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Feedback not found for message ID: ${messageId}`);
      }

      const feedback = result.rows[0];

      return {
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      };
    } catch (error) {
      console.error('Error marking feedback as dismissed:', error.message);
      throw error;
    }
  }

  /**
   * Get all feedback messages scheduled for deletion
   * Returns only non-dismissed messages where scheduled_deletion is in the past
   * @returns {Promise<Array>} List of feedback messages to delete
   */
  async getScheduledDeletions() {
    try {
      const result = await query(
        `SELECT * FROM operation_feedback
         WHERE dismissed = FALSE
         AND scheduled_deletion <= CURRENT_TIMESTAMP
         ORDER BY scheduled_deletion ASC`
      );

      return result.rows.map(feedback => ({
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      }));
    } catch (error) {
      console.error('Error getting scheduled deletions:', error.message);
      throw error;
    }
  }

  /**
   * Get all pending feedback (not yet deleted or dismissed)
   * @returns {Promise<Array>} List of pending feedback messages
   */
  async getPendingFeedback() {
    try {
      const result = await query(
        `SELECT * FROM operation_feedback
         WHERE dismissed = FALSE
         ORDER BY scheduled_deletion ASC`
      );

      return result.rows.map(feedback => ({
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      }));
    } catch (error) {
      console.error('Error getting pending feedback:', error.message);
      throw error;
    }
  }

  /**
   * Delete feedback record
   * @param {number} messageId - Telegram message ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteFeedback(messageId) {
    try {
      const result = await query(
        'DELETE FROM operation_feedback WHERE feedback_message_id = $1',
        [messageId]
      );

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting feedback:', error.message);
      throw error;
    }
  }

  /**
   * Update scheduled deletion time
   * @param {number} messageId - Telegram message ID
   * @param {Date|string} newScheduledDeletion - New scheduled deletion time
   * @returns {Promise<Object>} Updated feedback record
   */
  async updateScheduledDeletion(messageId, newScheduledDeletion) {
    try {
      const result = await query(
        `UPDATE operation_feedback
         SET scheduled_deletion = $2
         WHERE feedback_message_id = $1
         RETURNING *`,
        [messageId, newScheduledDeletion]
      );

      if (result.rows.length === 0) {
        throw new Error(`Feedback not found for message ID: ${messageId}`);
      }

      const feedback = result.rows[0];

      return {
        id: feedback.id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        operationId: feedback.operation_id,
        chatId: feedback.telegram_chat_id,
        feedbackMessageId: feedback.feedback_message_id,
        scheduledDeletion: feedback.scheduled_deletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.created_at,
      };
    } catch (error) {
      console.error('Error updating scheduled deletion:', error.message);
      throw error;
    }
  }

  /**
   * Clean up old feedback records (for maintenance)
   * Deletes feedback records older than the specified number of days
   * @param {number} daysOld - Age in days
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupOldFeedback(daysOld = 30) {
    try {
      // Input validation
      if (typeof daysOld !== 'number' || daysOld < 1 || daysOld > 3650) {
        throw new Error('daysOld must be a number between 1 and 3650 (10 years)');
      }

      // Use parameterized query to prevent SQL injection
      const result = await query(
        `DELETE FROM operation_feedback
         WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1`,
        [daysOld]
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old feedback:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export default new FeedbackRepository();
