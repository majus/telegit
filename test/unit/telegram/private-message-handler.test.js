/**
 * Unit tests for private message handler
 * Tests whitelist checks, session routing, and error messages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockTelegramMessage, mockTelegramUser } from '../../mocks/telegram.js';

// Mock the auth-setup module
vi.mock('../../../src/services/telegram/auth-setup.js', () => ({
  handleSetupMessage: vi.fn(),
}));

// Import after mocking
import {
  handlePrivateMessage,
  createPrivateMessageHandler,
} from '../../../src/services/telegram/private-message-handler.js';
import { handleSetupMessage } from '../../../src/services/telegram/auth-setup.js';

describe('Private Message Handler', () => {
  let mockCtx;
  let mockValidatePatFn;

  beforeEach(() => {
    vi.mocked(handleSetupMessage).mockResolvedValue(undefined);
    mockValidatePatFn = vi.fn().mockResolvedValue(true);

    mockCtx = {
      message: mockTelegramMessage({
        from: mockTelegramUser({ id: 123456 }),
        text: 'Setup message',
      }),
      reply: vi.fn().mockResolvedValue(undefined),
    };

    vi.clearAllMocks();
  });

  describe('handlePrivateMessage', () => {
    it('should reject non-whitelisted user with error message', async () => {
      const filterResult = {
        isWhitelisted: false,
        hasSession: false,
        metadata: { userId: 123456 },
      };

      await handlePrivateMessage(mockCtx, filterResult);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ You are not authorized to use this bot. Please contact your administrator.'
      );
      expect(handleSetupMessage).not.toHaveBeenCalled();
    });

    it('should route whitelisted user to setup handler', async () => {
      const filterResult = {
        isWhitelisted: true,
        hasSession: false,
        metadata: { userId: 123456 },
      };

      await handlePrivateMessage(mockCtx, filterResult, mockValidatePatFn);

      expect(handleSetupMessage).toHaveBeenCalledWith(mockCtx, mockValidatePatFn);
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });

    it('should route whitelisted user with session to setup handler', async () => {
      const filterResult = {
        isWhitelisted: true,
        hasSession: true,
        metadata: { userId: 123456 },
      };

      await handlePrivateMessage(mockCtx, filterResult, mockValidatePatFn);

      expect(handleSetupMessage).toHaveBeenCalledWith(mockCtx, mockValidatePatFn);
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });

    it('should handle errors from setup handler', async () => {
      const filterResult = {
        isWhitelisted: true,
        hasSession: false,
        metadata: { userId: 123456 },
      };

      const setupError = new Error('Setup failed');
      vi.mocked(handleSetupMessage).mockRejectedValueOnce(setupError);

      await handlePrivateMessage(mockCtx, filterResult, mockValidatePatFn);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ An error occurred while processing your message')
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Setup failed')
      );
    });
  });

  describe('createPrivateMessageHandler', () => {
    it('should create handler that uses filter result from context', async () => {
      const filterResult = {
        isWhitelisted: true,
        hasSession: false,
        metadata: { userId: 123456 },
      };

      mockCtx.state = { privateFilterResult: filterResult };

      const handler = createPrivateMessageHandler(mockValidatePatFn);
      await handler(mockCtx);

      expect(handleSetupMessage).toHaveBeenCalledWith(mockCtx, mockValidatePatFn);
    });

    it('should handle missing filter result gracefully', async () => {
      mockCtx.state = {};

      const handler = createPrivateMessageHandler();
      await handler(mockCtx);

      // Should not crash, just return early
      expect(handleSetupMessage).not.toHaveBeenCalled();
    });
  });
});
