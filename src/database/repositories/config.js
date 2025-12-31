/**
 * ConfigRepository
 * Manages group configuration including encrypted GitHub credentials
 */

import { getDb, ObjectId } from '../db.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import logger from '../../utils/logger.js';

/**
 * Repository for managing group configurations
 */
export class ConfigRepository {
  /**
   * Get configuration for a Telegram group
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<Object|null>} Group configuration or null if not found
   */
  async getGroupConfig(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('group_configs');

      const config = await collection.findOne({ telegramGroupId: Long.fromNumber(groupId) });

      if (!config) {
        return null;
      }

      // Decrypt GitHub token before returning
      return {
        id: config._id.toString(),
        telegramGroupId: Number(config.telegramGroupId),
        githubRepo: config.githubRepo,
        githubToken: decrypt(config.encryptedGithubToken),
        managerUserId: Number(config.managerUserId),
        settings: config.settings || {},
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    } catch (error) {
      logger.error({ err: error, groupId }, 'Error getting group config');
      throw error;
    }
  }

  /**
   * Create or update configuration for a Telegram group
   * @param {number} groupId - Telegram group ID
   * @param {Object} config - Configuration object
   * @param {string} config.githubRepo - GitHub repository (owner/repo)
   * @param {string} config.githubToken - GitHub Personal Access Token (will be encrypted)
   * @param {number} config.managerUserId - User ID of the manager who configured
   * @param {Object} [config.settings={}] - Additional settings
   * @returns {Promise<Object>} Created/updated configuration
   */
  async setGroupConfig(groupId, config) {
    try {
      const { githubRepo, githubToken, managerUserId, settings = {} } = config;

      // Validate required fields
      if (!githubRepo || !githubToken || !managerUserId) {
        throw new Error('Missing required fields: githubRepo, githubToken, managerUserId');
      }

      // Encrypt the GitHub token
      const encryptedToken = encrypt(githubToken);

      const db = await getDb();
      const collection = db.collection('group_configs');

      const now = new Date();
      const result = await collection.findOneAndUpdate(
        { telegramGroupId: Long.fromNumber(groupId) },
        {
          $set: {
            githubRepo,
            encryptedGithubToken: encryptedToken,
            managerUserId: Long.fromNumber(managerUserId),
            settings,
            updatedAt: now,
          },
          $setOnInsert: {
            telegramGroupId: Long.fromNumber(groupId),
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: 'after' }
      );

      const savedConfig = result;

      return {
        id: savedConfig._id.toString(),
        telegramGroupId: Number(savedConfig.telegramGroupId),
        githubRepo: savedConfig.githubRepo,
        githubToken: decrypt(savedConfig.encryptedGithubToken),
        managerUserId: Number(savedConfig.managerUserId),
        settings: savedConfig.settings,
        createdAt: savedConfig.createdAt,
        updatedAt: savedConfig.updatedAt,
      };
    } catch (error) {
      logger.error({ err: error, groupId }, 'Error setting group config');
      throw error;
    }
  }

  /**
   * Update settings for a group configuration
   * @param {number} groupId - Telegram group ID
   * @param {Object} settings - Settings to merge with existing settings
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSettings(groupId, settings) {
    try {
      const db = await getDb();
      const collection = db.collection('group_configs');

      // Get existing settings first
      const existing = await collection.findOne({ telegramGroupId: Long.fromNumber(groupId) });

      if (!existing) {
        throw new Error(`Group configuration not found for group ID: ${groupId}`);
      }

      // Merge settings
      const mergedSettings = { ...existing.settings, ...settings };

      const result = await collection.findOneAndUpdate(
        { telegramGroupId: Long.fromNumber(groupId) },
        {
          $set: {
            settings: mergedSettings,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Group configuration not found for group ID: ${groupId}`);
      }

      const config = result;

      return {
        id: config._id.toString(),
        telegramGroupId: Number(config.telegramGroupId),
        githubRepo: config.githubRepo,
        githubToken: decrypt(config.encryptedGithubToken),
        managerUserId: Number(config.managerUserId),
        settings: config.settings,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };
    } catch (error) {
      logger.error({ err: error, groupId, settings }, 'Error updating settings');
      throw error;
    }
  }

  /**
   * Delete configuration for a Telegram group
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteGroupConfig(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('group_configs');

      const result = await collection.deleteOne({ telegramGroupId: Long.fromNumber(groupId) });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error({ err: error, groupId }, 'Error deleting group config');
      throw error;
    }
  }

  /**
   * Check if a group has configuration
   * @param {number} groupId - Telegram group ID
   * @returns {Promise<boolean>} True if configuration exists
   */
  async hasConfig(groupId) {
    try {
      const db = await getDb();
      const collection = db.collection('group_configs');

      const count = await collection.countDocuments({ telegramGroupId: Long.fromNumber(groupId) });

      return count > 0;
    } catch (error) {
      logger.error({ err: error, groupId }, 'Error checking group config');
      throw error;
    }
  }

  /**
   * Get all configured groups
   * @returns {Promise<Array>} List of all group configurations
   */
  async getAllGroups() {
    try {
      const db = await getDb();
      const collection = db.collection('group_configs');

      const configs = await collection
        .find({}, { projection: { encryptedGithubToken: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      // Don't decrypt tokens when listing all groups (security)
      return configs.map(config => ({
        id: config._id.toString(),
        telegramGroupId: Number(config.telegramGroupId),
        githubRepo: config.githubRepo,
        managerUserId: Number(config.managerUserId),
        settings: config.settings || {},
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Error getting all groups');
      throw error;
    }
  }
}

// Helper to convert number to Long (MongoDB's 64-bit integer type)
const Long = {
  fromNumber: (num) => num,
};

// Export singleton instance
export default new ConfigRepository();
