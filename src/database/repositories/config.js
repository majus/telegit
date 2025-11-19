/**
 * ConfigRepository
 * Manages group configuration including encrypted GitHub credentials
 */

import { query, getClient } from '../db.js';
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
      const result = await query(
        'SELECT * FROM group_configs WHERE telegram_group_id = $1',
        [groupId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows[0];

      // Decrypt GitHub token before returning
      return {
        telegramGroupId: config.telegram_group_id,
        githubRepo: config.github_repo,
        githubToken: decrypt(config.encrypted_github_token),
        managerUserId: config.manager_user_id,
        settings: config.settings,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
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

      const result = await query(
        `INSERT INTO group_configs (
          telegram_group_id,
          github_repo,
          encrypted_github_token,
          manager_user_id,
          settings,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (telegram_group_id)
        DO UPDATE SET
          github_repo = EXCLUDED.github_repo,
          encrypted_github_token = EXCLUDED.encrypted_github_token,
          manager_user_id = EXCLUDED.manager_user_id,
          settings = EXCLUDED.settings,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *`,
        [groupId, githubRepo, encryptedToken, managerUserId, JSON.stringify(settings)]
      );

      const savedConfig = result.rows[0];

      return {
        telegramGroupId: savedConfig.telegram_group_id,
        githubRepo: savedConfig.github_repo,
        githubToken: decrypt(savedConfig.encrypted_github_token),
        managerUserId: savedConfig.manager_user_id,
        settings: savedConfig.settings,
        createdAt: savedConfig.created_at,
        updatedAt: savedConfig.updated_at,
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
      const result = await query(
        `UPDATE group_configs
         SET settings = settings || $2::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE telegram_group_id = $1
         RETURNING *`,
        [groupId, JSON.stringify(settings)]
      );

      if (result.rows.length === 0) {
        throw new Error(`Group configuration not found for group ID: ${groupId}`);
      }

      const config = result.rows[0];

      return {
        telegramGroupId: config.telegram_group_id,
        githubRepo: config.github_repo,
        githubToken: decrypt(config.encrypted_github_token),
        managerUserId: config.manager_user_id,
        settings: config.settings,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
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
      const result = await query(
        'DELETE FROM group_configs WHERE telegram_group_id = $1',
        [groupId]
      );

      return result.rowCount > 0;
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
      const result = await query(
        'SELECT 1 FROM group_configs WHERE telegram_group_id = $1',
        [groupId]
      );

      return result.rows.length > 0;
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
      const result = await query(
        'SELECT telegram_group_id, github_repo, manager_user_id, settings, created_at, updated_at FROM group_configs ORDER BY created_at DESC'
      );

      // Don't decrypt tokens when listing all groups (security)
      return result.rows.map(config => ({
        telegramGroupId: config.telegram_group_id,
        githubRepo: config.github_repo,
        managerUserId: config.manager_user_id,
        settings: config.settings,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      }));
    } catch (error) {
      logger.error({ err: error }, 'Error getting all groups');
      throw error;
    }
  }
}

// Export singleton instance
export default new ConfigRepository();
