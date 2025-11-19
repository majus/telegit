/**
 * Unit Tests for Whitelist Module
 *
 * Tests access control functionality including:
 * - Group whitelist enforcement
 * - User whitelist enforcement
 * - Whitelist parsing from environment
 * - Combined message validation
 * - Error handling for invalid configurations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAllowedGroups,
  getAllowedUsers,
  isGroupAllowed,
  isUserAllowed,
  isMessageAllowed,
  getWhitelistStatus
} from '../../../../src/services/telegram/whitelist.js';

describe('whitelist', () => {
  let originalAllowedGroups;
  let originalAllowedUsers;

  beforeEach(() => {
    // Save original environment variables
    originalAllowedGroups = process.env.ALLOWED_GROUPS;
    originalAllowedUsers = process.env.ALLOWED_USERS;
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalAllowedGroups !== undefined) {
      process.env.ALLOWED_GROUPS = originalAllowedGroups;
    } else {
      delete process.env.ALLOWED_GROUPS;
    }

    if (originalAllowedUsers !== undefined) {
      process.env.ALLOWED_USERS = originalAllowedUsers;
    } else {
      delete process.env.ALLOWED_USERS;
    }
  });

  describe('getAllowedGroups', () => {
    it('should return null when ALLOWED_GROUPS is not set', () => {
      delete process.env.ALLOWED_GROUPS;
      expect(getAllowedGroups()).toBeNull();
    });

    it('should return null when ALLOWED_GROUPS is empty', () => {
      process.env.ALLOWED_GROUPS = '';
      expect(getAllowedGroups()).toBeNull();
    });

    it('should return null when ALLOWED_GROUPS is only whitespace', () => {
      process.env.ALLOWED_GROUPS = '   ';
      expect(getAllowedGroups()).toBeNull();
    });

    it('should parse single group ID', () => {
      process.env.ALLOWED_GROUPS = '-123456789';
      const groups = getAllowedGroups();
      expect(groups).toBeInstanceOf(Set);
      expect(groups.size).toBe(1);
      expect(groups.has(-123456789)).toBe(true);
    });

    it('should parse multiple group IDs', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321,-111111111';
      const groups = getAllowedGroups();
      expect(groups.size).toBe(3);
      expect(groups.has(-123456789)).toBe(true);
      expect(groups.has(-987654321)).toBe(true);
      expect(groups.has(-111111111)).toBe(true);
    });

    it('should handle whitespace around group IDs', () => {
      process.env.ALLOWED_GROUPS = ' -123456789 , -987654321 , -111111111 ';
      const groups = getAllowedGroups();
      expect(groups.size).toBe(3);
      expect(groups.has(-123456789)).toBe(true);
      expect(groups.has(-987654321)).toBe(true);
      expect(groups.has(-111111111)).toBe(true);
    });

    it('should handle trailing commas', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321,';
      const groups = getAllowedGroups();
      expect(groups.size).toBe(2);
      expect(groups.has(-123456789)).toBe(true);
      expect(groups.has(-987654321)).toBe(true);
    });

    it('should throw error for invalid group ID', () => {
      process.env.ALLOWED_GROUPS = '-123456789,invalid,-987654321';
      expect(() => getAllowedGroups()).toThrow('Invalid ALLOWED_GROUPS: "invalid" is not a valid number');
    });

    it('should throw error for non-numeric group ID', () => {
      process.env.ALLOWED_GROUPS = 'abc123';
      expect(() => getAllowedGroups()).toThrow('Invalid ALLOWED_GROUPS');
    });
  });

  describe('getAllowedUsers', () => {
    it('should return null when ALLOWED_USERS is not set', () => {
      delete process.env.ALLOWED_USERS;
      expect(getAllowedUsers()).toBeNull();
    });

    it('should return null when ALLOWED_USERS is empty', () => {
      process.env.ALLOWED_USERS = '';
      expect(getAllowedUsers()).toBeNull();
    });

    it('should parse single user ID', () => {
      process.env.ALLOWED_USERS = '123456789';
      const users = getAllowedUsers();
      expect(users).toBeInstanceOf(Set);
      expect(users.size).toBe(1);
      expect(users.has(123456789)).toBe(true);
    });

    it('should parse multiple user IDs', () => {
      process.env.ALLOWED_USERS = '123456789,987654321,111111111';
      const users = getAllowedUsers();
      expect(users.size).toBe(3);
      expect(users.has(123456789)).toBe(true);
      expect(users.has(987654321)).toBe(true);
      expect(users.has(111111111)).toBe(true);
    });

    it('should handle whitespace around user IDs', () => {
      process.env.ALLOWED_USERS = ' 123456789 , 987654321 , 111111111 ';
      const users = getAllowedUsers();
      expect(users.size).toBe(3);
    });

    it('should throw error for invalid user ID', () => {
      process.env.ALLOWED_USERS = '123456789,invalid,987654321';
      expect(() => getAllowedUsers()).toThrow('Invalid ALLOWED_USERS: "invalid" is not a valid number');
    });
  });

  describe('isGroupAllowed', () => {
    it('should return true when whitelist is disabled', () => {
      delete process.env.ALLOWED_GROUPS;
      expect(isGroupAllowed(-123456789)).toBe(true);
      expect(isGroupAllowed(-987654321)).toBe(true);
    });

    it('should return true for whitelisted group', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321';
      expect(isGroupAllowed(-123456789)).toBe(true);
      expect(isGroupAllowed(-987654321)).toBe(true);
    });

    it('should return false for non-whitelisted group', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321';
      expect(isGroupAllowed(-111111111)).toBe(false);
      expect(isGroupAllowed(-999999999)).toBe(false);
    });

    it('should throw error for non-number group ID', () => {
      expect(() => isGroupAllowed('not-a-number')).toThrow('Group ID must be a number');
      expect(() => isGroupAllowed(null)).toThrow('Group ID must be a number');
      expect(() => isGroupAllowed(undefined)).toThrow('Group ID must be a number');
    });

    it('should work with positive numbers (for testing)', () => {
      process.env.ALLOWED_GROUPS = '123456789';
      expect(isGroupAllowed(123456789)).toBe(true);
    });
  });

  describe('isUserAllowed', () => {
    it('should return true when whitelist is disabled', () => {
      delete process.env.ALLOWED_USERS;
      expect(isUserAllowed(123456789)).toBe(true);
      expect(isUserAllowed(987654321)).toBe(true);
    });

    it('should return true for whitelisted user', () => {
      process.env.ALLOWED_USERS = '123456789,987654321';
      expect(isUserAllowed(123456789)).toBe(true);
      expect(isUserAllowed(987654321)).toBe(true);
    });

    it('should return false for non-whitelisted user', () => {
      process.env.ALLOWED_USERS = '123456789,987654321';
      expect(isUserAllowed(111111111)).toBe(false);
      expect(isUserAllowed(999999999)).toBe(false);
    });

    it('should throw error for non-number user ID', () => {
      expect(() => isUserAllowed('not-a-number')).toThrow('User ID must be a number');
      expect(() => isUserAllowed(null)).toThrow('User ID must be a number');
      expect(() => isUserAllowed(undefined)).toThrow('User ID must be a number');
    });
  });

  describe('isMessageAllowed', () => {
    it('should allow message when both whitelists are disabled', () => {
      delete process.env.ALLOWED_GROUPS;
      delete process.env.ALLOWED_USERS;

      const result = isMessageAllowed(-123456789, 987654321);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow message when both group and user are whitelisted', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321';
      process.env.ALLOWED_USERS = '111111111,222222222';

      const result = isMessageAllowed(-123456789, 111111111);
      expect(result.allowed).toBe(true);
    });

    it('should deny message when group is not whitelisted', () => {
      process.env.ALLOWED_GROUPS = '-123456789';
      process.env.ALLOWED_USERS = '111111111';

      const result = isMessageAllowed(-999999999, 111111111);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Group not whitelisted');
    });

    it('should deny message when user is not whitelisted', () => {
      process.env.ALLOWED_GROUPS = '-123456789';
      process.env.ALLOWED_USERS = '111111111';

      const result = isMessageAllowed(-123456789, 999999999);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('User not whitelisted');
    });

    it('should check group before user', () => {
      process.env.ALLOWED_GROUPS = '-123456789';
      process.env.ALLOWED_USERS = '111111111';

      // Both group and user not whitelisted, should get group error first
      const result = isMessageAllowed(-999999999, 999999999);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Group not whitelisted');
    });

    it('should allow when only group whitelist is enabled', () => {
      process.env.ALLOWED_GROUPS = '-123456789';
      delete process.env.ALLOWED_USERS;

      const result = isMessageAllowed(-123456789, 999999999);
      expect(result.allowed).toBe(true);
    });

    it('should allow when only user whitelist is enabled', () => {
      delete process.env.ALLOWED_GROUPS;
      process.env.ALLOWED_USERS = '111111111';

      const result = isMessageAllowed(-999999999, 111111111);
      expect(result.allowed).toBe(true);
    });
  });

  describe('getWhitelistStatus', () => {
    it('should report both whitelists disabled', () => {
      delete process.env.ALLOWED_GROUPS;
      delete process.env.ALLOWED_USERS;

      const status = getWhitelistStatus();
      expect(status).toEqual({
        groupWhitelistEnabled: false,
        userWhitelistEnabled: false,
        allowedGroupCount: 0,
        allowedUserCount: 0
      });
    });

    it('should report group whitelist enabled', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321,-111111111';
      delete process.env.ALLOWED_USERS;

      const status = getWhitelistStatus();
      expect(status).toEqual({
        groupWhitelistEnabled: true,
        userWhitelistEnabled: false,
        allowedGroupCount: 3,
        allowedUserCount: 0
      });
    });

    it('should report user whitelist enabled', () => {
      delete process.env.ALLOWED_GROUPS;
      process.env.ALLOWED_USERS = '123456789,987654321';

      const status = getWhitelistStatus();
      expect(status).toEqual({
        groupWhitelistEnabled: false,
        userWhitelistEnabled: true,
        allowedGroupCount: 0,
        allowedUserCount: 2
      });
    });

    it('should report both whitelists enabled', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-987654321';
      process.env.ALLOWED_USERS = '111111111,222222222,333333333';

      const status = getWhitelistStatus();
      expect(status).toEqual({
        groupWhitelistEnabled: true,
        userWhitelistEnabled: true,
        allowedGroupCount: 2,
        allowedUserCount: 3
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very large group IDs', () => {
      const largeId = -1234567890123456;
      process.env.ALLOWED_GROUPS = largeId.toString();
      expect(isGroupAllowed(largeId)).toBe(true);
    });

    it('should handle very large user IDs', () => {
      const largeId = 1234567890123456;
      process.env.ALLOWED_USERS = largeId.toString();
      expect(isUserAllowed(largeId)).toBe(true);
    });

    it('should handle zero as group ID', () => {
      process.env.ALLOWED_GROUPS = '0';
      expect(isGroupAllowed(0)).toBe(true);
    });

    it('should handle zero as user ID', () => {
      process.env.ALLOWED_USERS = '0';
      expect(isUserAllowed(0)).toBe(true);
    });

    it('should deduplicate IDs in whitelist', () => {
      process.env.ALLOWED_GROUPS = '-123456789,-123456789,-987654321';
      const groups = getAllowedGroups();
      expect(groups.size).toBe(2); // Set automatically deduplicates
    });
  });
});
