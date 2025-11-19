/**
 * Whitelist Module
 *
 * Provides access control for Telegram groups and users.
 * Supports whitelisting via environment variables to restrict
 * bot usage to authorized groups and users only.
 *
 * Security features:
 * - Group ID whitelist enforcement
 * - User ID whitelist enforcement
 * - Optional whitelisting (disabled if env vars not set)
 * - Clear error messages for unauthorized access
 */

/**
 * Parse comma-separated IDs from environment variable
 * @param {string} envVar - Environment variable name
 * @returns {Set<number>|null} Set of allowed IDs or null if not configured
 */
function parseWhitelist(envVar) {
  const value = process.env[envVar];

  if (!value || value.trim() === '') {
    return null; // Whitelist disabled
  }

  // Split by comma and parse as integers
  const ids = value
    .split(',')
    .map(id => id.trim())
    .filter(id => id !== '')
    .map(id => {
      const parsed = parseInt(id, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid ${envVar}: "${id}" is not a valid number`);
      }
      return parsed;
    });

  return new Set(ids);
}

/**
 * Get allowed group IDs from environment
 * @returns {Set<number>|null} Set of allowed group IDs or null if whitelist disabled
 * @throws {Error} If ALLOWED_GROUPS contains invalid IDs
 */
export function getAllowedGroups() {
  return parseWhitelist('ALLOWED_GROUPS');
}

/**
 * Get allowed user IDs from environment
 * @returns {Set<number>|null} Set of allowed user IDs or null if whitelist disabled
 * @throws {Error} If ALLOWED_USERS contains invalid IDs
 */
export function getAllowedUsers() {
  return parseWhitelist('ALLOWED_USERS');
}

/**
 * Check if a group is allowed to use the bot
 * @param {number} groupId - Telegram group ID (negative number for groups)
 * @returns {boolean} True if group is allowed, false otherwise
 *
 * @example
 * // With ALLOWED_GROUPS="-123456789,-987654321"
 * isGroupAllowed(-123456789); // true
 * isGroupAllowed(-111111111); // false
 *
 * @example
 * // Without ALLOWED_GROUPS (whitelist disabled)
 * isGroupAllowed(-123456789); // true (all groups allowed)
 */
export function isGroupAllowed(groupId) {
  if (typeof groupId !== 'number') {
    throw new Error('Group ID must be a number');
  }

  const allowedGroups = getAllowedGroups();

  // If whitelist is disabled (null), allow all groups
  if (allowedGroups === null) {
    return true;
  }

  // Check if group is in whitelist
  return allowedGroups.has(groupId);
}

/**
 * Check if a user is allowed to use the bot
 * @param {number} userId - Telegram user ID (positive number)
 * @returns {boolean} True if user is allowed, false otherwise
 *
 * @example
 * // With ALLOWED_USERS="123456789,987654321"
 * isUserAllowed(123456789); // true
 * isUserAllowed(111111111); // false
 *
 * @example
 * // Without ALLOWED_USERS (whitelist disabled)
 * isUserAllowed(123456789); // true (all users allowed)
 */
export function isUserAllowed(userId) {
  if (typeof userId !== 'number') {
    throw new Error('User ID must be a number');
  }

  const allowedUsers = getAllowedUsers();

  // If whitelist is disabled (null), allow all users
  if (allowedUsers === null) {
    return true;
  }

  // Check if user is in whitelist
  return allowedUsers.has(userId);
}

/**
 * Check if a message is from an allowed group and user
 * @param {number} groupId - Telegram group ID
 * @param {number} userId - Telegram user ID
 * @returns {{allowed: boolean, reason?: string}} Result with reason if not allowed
 *
 * @example
 * const result = isMessageAllowed(-123456789, 987654321);
 * if (!result.allowed) {
 *   console.log(result.reason); // "Group not whitelisted" or "User not whitelisted"
 * }
 */
export function isMessageAllowed(groupId, userId) {
  if (!isGroupAllowed(groupId)) {
    return {
      allowed: false,
      reason: 'Group not whitelisted'
    };
  }

  if (!isUserAllowed(userId)) {
    return {
      allowed: false,
      reason: 'User not whitelisted'
    };
  }

  return { allowed: true };
}

/**
 * Get whitelist status for debugging/monitoring
 * @returns {{groupWhitelistEnabled: boolean, userWhitelistEnabled: boolean, allowedGroupCount: number, allowedUserCount: number}}
 *
 * @example
 * const status = getWhitelistStatus();
 * console.log(status);
 * // {
 * //   groupWhitelistEnabled: true,
 * //   userWhitelistEnabled: false,
 * //   allowedGroupCount: 2,
 * //   allowedUserCount: 0
 * // }
 */
export function getWhitelistStatus() {
  const allowedGroups = getAllowedGroups();
  const allowedUsers = getAllowedUsers();

  return {
    groupWhitelistEnabled: allowedGroups !== null,
    userWhitelistEnabled: allowedUsers !== null,
    allowedGroupCount: allowedGroups ? allowedGroups.size : 0,
    allowedUserCount: allowedUsers ? allowedUsers.size : 0
  };
}
