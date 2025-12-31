/**
 * FeedbackRepository
 * Manages feedback messages for auto-deletion and reaction controls
 */

import { getDb, ObjectId } from '../db.js';
import logger from '../../utils/logger.js';

/**
 * Repository for managing feedback messages
 */
export class FeedbackRepository {
  /**
   * Create a feedback message record
   * @param {Object} data - Feedback data
   * @param {string} data.operationId - Operation ObjectId string
   * @param {number} data.chatId - Telegram chat ID
   * @param {number} data.feedbackMessageId - Telegram message ID of the feedback
   * @param {Date|string} data.scheduledDeletion - Timestamp when message should be deleted
   * @returns {Promise<Object>} Created feedback record
   */
  async createFeedback(data) {
    try {
      const { operationId, chatId, feedbackMessageId, scheduledDeletion } = data;

      // Validate required fields
      if (!operationId || !chatId || !feedbackMessageId || !scheduledDeletion) {
        throw new Error('Missing required fields: operationId, chatId, feedbackMessageId, scheduledDeletion');
      }

      // Type validation for IDs
      if (typeof chatId !== 'number' || typeof feedbackMessageId !== 'number') {
        throw new Error('chatId and feedbackMessageId must be numbers');
      }

      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const now = new Date();
      const doc = {
        operationId: new ObjectId(operationId),
        telegramChatId: Long.fromNumber(chatId),
        feedbackMessageId: Long.fromNumber(feedbackMessageId),
        scheduledDeletion: new Date(scheduledDeletion),
        dismissed: false,
        createdAt: now,
      };

      const result = await collection.insertOne(doc);

      return {
        id: result.insertedId.toString(),
        operationId,
        chatId,
        feedbackMessageId,
        scheduledDeletion: doc.scheduledDeletion,
        dismissed: false,
        createdAt: now,
      };
    } catch (error) {
      logger.error({ err: error, operationId, chatId, feedbackMessageId }, 'Error creating feedback');
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
      // Type validation
      if (typeof messageId !== 'number') {
        throw new Error('messageId must be a number');
      }

      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const feedback = await collection.findOne({ feedbackMessageId: Long.fromNumber(messageId) });

      if (!feedback) {
        return null;
      }

      return {
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, messageId }, 'Error getting feedback by message ID');
      throw error;
    }
  }

  /**
   * Get feedback by operation ID
   * @param {string} operationId - Operation ObjectId string
   * @returns {Promise<Object|null>} Feedback record or null if not found
   */
  async getFeedbackByOperationId(operationId) {
    try {
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const feedback = await collection.findOne({ operationId: new ObjectId(operationId) });

      if (!feedback) {
        return null;
      }

      return {
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, operationId }, 'Error getting feedback by operation ID');
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
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const result = await collection.findOneAndUpdate(
        { feedbackMessageId: Long.fromNumber(messageId) },
        { $set: { dismissed: true } },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Feedback not found for message ID: ${messageId}`);
      }

      const feedback = result;

      return {
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, messageId }, 'Error marking feedback as dismissed');
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
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const feedbacks = await collection
        .find({
          dismissed: false,
          scheduledDeletion: { $lte: new Date() },
        })
        .sort({ scheduledDeletion: 1 })
        .toArray();

      return feedbacks.map(feedback => ({
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Error getting scheduled deletions');
      throw error;
    }
  }

  /**
   * Get all pending feedback (not yet deleted or dismissed)
   * @returns {Promise<Array>} List of pending feedback messages
   */
  async getPendingFeedback() {
    try {
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const feedbacks = await collection
        .find({ dismissed: false })
        .sort({ scheduledDeletion: 1 })
        .toArray();

      return feedbacks.map(feedback => ({
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Error getting pending feedback');
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
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const result = await collection.deleteOne({ feedbackMessageId: Long.fromNumber(messageId) });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error({ err: error, messageId }, 'Error deleting feedback');
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
      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const result = await collection.findOneAndUpdate(
        { feedbackMessageId: Long.fromNumber(messageId) },
        { $set: { scheduledDeletion: new Date(newScheduledDeletion) } },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Feedback not found for message ID: ${messageId}`);
      }

      const feedback = result;

      return {
        id: feedback._id.toString(),
        operationId: feedback.operationId.toString(),
        chatId: Number(feedback.telegramChatId),
        feedbackMessageId: Number(feedback.feedbackMessageId),
        scheduledDeletion: feedback.scheduledDeletion,
        dismissed: feedback.dismissed,
        createdAt: feedback.createdAt,
      };
    } catch (error) {
      logger.error({ err: error, messageId, newScheduledDeletion }, 'Error updating scheduled deletion');
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

      const db = await getDb();
      const collection = db.collection('operation_feedback');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await collection.deleteMany({
        createdAt: { $lt: cutoffDate },
      });

      return result.deletedCount;
    } catch (error) {
      logger.error({ err: error, daysOld }, 'Error cleaning up old feedback');
      throw error;
    }
  }
}

// Helper to convert number to Long (MongoDB's 64-bit integer type)
const Long = {
  fromNumber: (num) => num,
};

// Export singleton instance
export default new FeedbackRepository();
