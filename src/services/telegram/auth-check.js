/**
 * GitHub authentication check for Telegram groups
 * Verifies if a group has configured GitHub credentials
 */

import { ConfigRepository } from '../../database/repositories/config.js';

/**
 * Check if a Telegram group has GitHub authentication configured
 * @param {number} groupId - Telegram group ID
 * @returns {Promise<boolean>} True if group has valid GitHub configuration
 */
export async function isGroupAuthenticated(groupId) {
  try {
    const configRepo = new ConfigRepository();
    const config = await configRepo.getGroupConfig(groupId);

    // Check if config exists and has required fields
    if (!config) {
      return false;
    }

    // Verify essential fields are present
    const hasRepo = config.githubRepo && config.githubRepo.trim().length > 0;
    const hasToken = config.githubToken && config.githubToken.trim().length > 0;

    return hasRepo && hasToken;
  } catch (error) {
    console.error('Error checking group authentication:', {
      groupId,
      error: error.message,
    });
    return false;
  }
}

/**
 * Get GitHub configuration for a group
 * @param {number} groupId - Telegram group ID
 * @returns {Promise<Object|null>} GitHub configuration or null
 */
export async function getGitHubConfig(groupId) {
  try {
    const configRepo = new ConfigRepository();
    const config = await configRepo.getGroupConfig(groupId);

    if (!config || !config.githubRepo || !config.githubToken) {
      return null;
    }

    return {
      repository: config.githubRepo,
      token: config.githubToken,
      managerUserId: config.managerUserId,
    };
  } catch (error) {
    console.error('Error getting GitHub config:', {
      groupId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Check if a user is the manager of a group
 * @param {number} groupId - Telegram group ID
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>} True if user is the group manager
 */
export async function isGroupManager(groupId, userId) {
  try {
    const configRepo = new ConfigRepository();
    const config = await configRepo.getGroupConfig(groupId);

    if (!config) {
      return false;
    }

    return config.managerUserId === userId;
  } catch (error) {
    console.error('Error checking group manager:', {
      groupId,
      userId,
      error: error.message,
    });
    return false;
  }
}
