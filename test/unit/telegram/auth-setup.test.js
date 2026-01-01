/**
 * Unit tests for GitHub authentication setup
 * Tests session management and cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startSetupSession,
  getSetupSession,
  updateSetupSession,
  endSetupSession,
  cleanupExpiredSessions,
  SESSION_TIMEOUT_MS,
} from '../../../src/services/telegram/auth-setup.js';

describe('Auth Setup Session Management', () => {
  const userId = 123456;
  const groupId = -987654321;

  beforeEach(() => {
    // Clear any existing sessions before each test
    // We need to call cleanupExpiredSessions and endSetupSession to clear state
    const session = getSetupSession(userId);
    if (session) {
      endSetupSession(userId);
    }
  });

  describe('startSetupSession', () => {
    it('should create a new setup session', () => {
      const session = startSetupSession(userId, groupId);

      expect(session).toBeDefined();
      expect(session.step).toBe('awaiting_repo');
      expect(session.groupId).toBe(groupId);
      expect(session.timestamp).toBeGreaterThan(0);
      expect(session.data).toEqual({});
    });

    it('should store session so it can be retrieved', () => {
      startSetupSession(userId, groupId);
      const retrieved = getSetupSession(userId);

      expect(retrieved).toBeDefined();
      expect(retrieved.groupId).toBe(groupId);
    });
  });

  describe('getSetupSession', () => {
    it('should return null for non-existent session', () => {
      const session = getSetupSession(999999);
      expect(session).toBeNull();
    });

    it('should return active session', () => {
      startSetupSession(userId, groupId);
      const session = getSetupSession(userId);

      expect(session).toBeDefined();
      expect(session.groupId).toBe(groupId);
    });

    it('should return null for expired session', () => {
      const session = startSetupSession(userId, groupId);

      // Manually set timestamp to expired time
      session.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;

      const retrieved = getSetupSession(userId);
      expect(retrieved).toBeNull();
    });

    it('should delete expired session from storage', () => {
      const session = startSetupSession(userId, groupId);
      session.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;

      // First call should return null and delete
      getSetupSession(userId);

      // Second call should still return null
      const retrieved = getSetupSession(userId);
      expect(retrieved).toBeNull();
    });
  });

  describe('updateSetupSession', () => {
    it('should update existing session', () => {
      startSetupSession(userId, groupId);

      updateSetupSession(userId, {
        step: 'awaiting_pat',
        data: { repoUrl: 'https://github.com/owner/repo' },
      });

      const session = getSetupSession(userId);
      expect(session.step).toBe('awaiting_pat');
      expect(session.data.repoUrl).toBe('https://github.com/owner/repo');
    });

    it('should update timestamp when updating session', () => {
      const session = startSetupSession(userId, groupId);
      const originalTimestamp = session.timestamp;

      // Wait a bit
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      updateSetupSession(userId, { step: 'awaiting_pat' });

      const updated = getSetupSession(userId);
      expect(updated.timestamp).toBeGreaterThan(originalTimestamp);

      vi.useRealTimers();
    });

    it('should throw error when updating non-existent session', () => {
      expect(() => {
        updateSetupSession(999999, { step: 'awaiting_pat' });
      }).toThrow('No active setup session found');
    });
  });

  describe('endSetupSession', () => {
    it('should remove session from storage', () => {
      startSetupSession(userId, groupId);
      expect(getSetupSession(userId)).toBeDefined();

      endSetupSession(userId);
      expect(getSetupSession(userId)).toBeNull();
    });

    it('should not throw error when ending non-existent session', () => {
      expect(() => {
        endSetupSession(999999);
      }).not.toThrow();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions', () => {
      // Create multiple sessions
      const user1 = 111111;
      const user2 = 222222;
      const user3 = 333333;

      const session1 = startSetupSession(user1, groupId);
      const session2 = startSetupSession(user2, groupId);
      const session3 = startSetupSession(user3, groupId);

      // Expire first two sessions
      session1.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;
      session2.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;
      // Keep session3 fresh

      const cleaned = cleanupExpiredSessions();

      expect(cleaned).toBe(2);
      expect(getSetupSession(user1)).toBeNull();
      expect(getSetupSession(user2)).toBeNull();
      expect(getSetupSession(user3)).toBeDefined();

      // Cleanup
      endSetupSession(user3);
    });

    it('should return 0 when no sessions are expired', () => {
      const user1 = 111111;
      const user2 = 222222;

      startSetupSession(user1, groupId);
      startSetupSession(user2, groupId);

      const cleaned = cleanupExpiredSessions();

      expect(cleaned).toBe(0);
      expect(getSetupSession(user1)).toBeDefined();
      expect(getSetupSession(user2)).toBeDefined();

      // Cleanup
      endSetupSession(user1);
      endSetupSession(user2);
    });

    it('should return 0 when no sessions exist', () => {
      const cleaned = cleanupExpiredSessions();
      expect(cleaned).toBe(0);
    });

    it('should handle cleanup of all sessions when all expired', () => {
      const user1 = 111111;
      const user2 = 222222;

      const session1 = startSetupSession(user1, groupId);
      const session2 = startSetupSession(user2, groupId);

      // Expire all sessions
      session1.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;
      session2.timestamp = Date.now() - SESSION_TIMEOUT_MS - 1000;

      const cleaned = cleanupExpiredSessions();

      expect(cleaned).toBe(2);
      expect(getSetupSession(user1)).toBeNull();
      expect(getSetupSession(user2)).toBeNull();
    });
  });
});
