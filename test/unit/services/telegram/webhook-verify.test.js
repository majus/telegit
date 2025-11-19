/**
 * Unit Tests for Webhook Signature Verification Module
 *
 * Tests webhook verification functionality including:
 * - Secret token verification
 * - HMAC signature computation and verification
 * - Express middleware functionality
 * - Configuration validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  verifySecretToken,
  computeHmacSignature,
  verifyHmacSignature,
  verifyTelegramWebhook,
  verifyWebhookRequest,
  generateWebhookSecret,
  validateWebhookConfig
} from '../../../../src/services/telegram/webhook-verify.js';

describe('webhook-verify', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifySecretToken', () => {
    it('should return true for matching tokens', () => {
      const token = 'my-secret-token';
      const result = verifySecretToken(token, token);
      expect(result).toBe(true);
    });

    it('should return false for non-matching tokens', () => {
      const result = verifySecretToken('wrong-token', 'correct-token');
      expect(result).toBe(false);
    });

    it('should return true when expected token is not set', () => {
      const result = verifySecretToken('any-token', '');
      expect(result).toBe(true);

      const result2 = verifySecretToken('any-token', null);
      expect(result2).toBe(true);
    });

    it('should return false when received token is missing', () => {
      const result = verifySecretToken('', 'expected-token');
      expect(result).toBe(false);

      const result2 = verifySecretToken(null, 'expected-token');
      expect(result2).toBe(false);
    });

    it('should handle tokens of different lengths', () => {
      const result = verifySecretToken('short', 'this-is-a-much-longer-token');
      expect(result).toBe(false);
    });

    it('should use constant-time comparison', () => {
      // This is a basic test - actual timing attack resistance
      // would require more sophisticated testing
      const token = 'secret123';
      const wrong1 = 'secret124';
      const wrong2 = 'xecret123';

      expect(verifySecretToken(wrong1, token)).toBe(false);
      expect(verifySecretToken(wrong2, token)).toBe(false);
    });
  });

  describe('computeHmacSignature', () => {
    it('should compute HMAC signature for string data', () => {
      const data = 'Hello, World!';
      const secret = 'my-secret';

      const signature = computeHmacSignature(data, secret);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce consistent signatures', () => {
      const data = 'test data';
      const secret = 'secret';

      const sig1 = computeHmacSignature(data, secret);
      const sig2 = computeHmacSignature(data, secret);

      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different data', () => {
      const secret = 'secret';

      const sig1 = computeHmacSignature('data1', secret);
      const sig2 = computeHmacSignature('data2', secret);

      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const data = 'same data';

      const sig1 = computeHmacSignature(data, 'secret1');
      const sig2 = computeHmacSignature(data, 'secret2');

      expect(sig1).not.toBe(sig2);
    });

    it('should handle Buffer data', () => {
      const data = Buffer.from('test data', 'utf8');
      const secret = 'secret';

      const signature = computeHmacSignature(data, secret);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });
  });

  describe('verifyHmacSignature', () => {
    it('should verify correct signature', () => {
      const data = 'test data';
      const secret = 'my-secret';

      const signature = computeHmacSignature(data, secret);
      const result = verifyHmacSignature(data, signature, secret);

      expect(result).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const data = 'test data';
      const secret = 'my-secret';

      const wrongSignature = computeHmacSignature('different data', secret);
      const result = verifyHmacSignature(data, wrongSignature, secret);

      expect(result).toBe(false);
    });

    it('should reject signature computed with different secret', () => {
      const data = 'test data';

      const signature = computeHmacSignature(data, 'secret1');
      const result = verifyHmacSignature(data, signature, 'secret2');

      expect(result).toBe(false);
    });

    it('should return false for missing signature', () => {
      const result = verifyHmacSignature('data', '', 'secret');
      expect(result).toBe(false);

      const result2 = verifyHmacSignature('data', null, 'secret');
      expect(result2).toBe(false);
    });

    it('should return false for missing secret', () => {
      const result = verifyHmacSignature('data', 'sig', '');
      expect(result).toBe(false);

      const result2 = verifyHmacSignature('data', 'sig', null);
      expect(result2).toBe(false);
    });
  });

  describe('verifyTelegramWebhook', () => {
    it('should create middleware function', () => {
      const middleware = verifyTelegramWebhook();
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // Express middleware signature (req, res, next)
    });

    it('should allow request with valid token', () => {
      const secret = 'test-secret';
      const middleware = verifyTelegramWebhook({ secret, required: true });

      const req = {
        headers: {
          'x-telegram-bot-api-secret-token': secret
        }
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      const middleware = verifyTelegramWebhook({ secret: 'correct-secret', required: true });

      const req = {
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong-secret'
        }
      };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unauthorized' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with missing token when required', () => {
      const middleware = verifyTelegramWebhook({ secret: 'secret', required: true });

      const req = { headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request without token when not required', () => {
      const middleware = verifyTelegramWebhook({ secret: 'secret', required: false });

      const req = { headers: {} };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow request when secret is not configured and not required', () => {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
      const middleware = verifyTelegramWebhook({ required: false });

      const req = { headers: {} };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use custom header name', () => {
      const middleware = verifyTelegramWebhook({
        secret: 'test-secret',
        header: 'x-custom-header',
        required: true
      });

      const req = {
        headers: {
          'x-custom-header': 'test-secret'
        }
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle headers (Node.js automatically lowercases header names)', () => {
      const secret = 'test-secret';
      const middleware = verifyTelegramWebhook({ secret, required: true });

      // In Node.js/Express, headers are automatically lowercased
      const req = {
        headers: {
          'x-telegram-bot-api-secret-token': secret
        }
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('verifyWebhookRequest', () => {
    it('should verify request with valid token', () => {
      const secret = 'test-secret';
      const request = {
        headers: {
          'x-telegram-bot-api-secret-token': secret
        }
      };

      const result = verifyWebhookRequest(request, { secret });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject request with invalid token', () => {
      const request = {
        headers: {
          'x-telegram-bot-api-secret-token': 'wrong-secret'
        }
      };

      const result = verifyWebhookRequest(request, { secret: 'correct-secret' });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject request with missing token', () => {
      const request = { headers: {} };

      const result = verifyWebhookRequest(request, { secret: 'test-secret' });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing');
    });

    it('should reject when secret is not configured', () => {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;
      const request = {
        headers: {
          'x-telegram-bot-api-secret-token': 'some-token'
        }
      };

      const result = verifyWebhookRequest(request, {});

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('generateWebhookSecret', () => {
    it('should generate a random secret', () => {
      const secret = generateWebhookSecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBe(64); // Default 32 bytes = 64 hex characters
    });

    it('should generate different secrets each time', () => {
      const secret1 = generateWebhookSecret();
      const secret2 = generateWebhookSecret();
      const secret3 = generateWebhookSecret();

      expect(secret1).not.toBe(secret2);
      expect(secret2).not.toBe(secret3);
      expect(secret1).not.toBe(secret3);
    });

    it('should generate secrets of specified length', () => {
      const secret16 = generateWebhookSecret(16);
      const secret64 = generateWebhookSecret(64);

      expect(secret16.length).toBe(32); // 16 bytes = 32 hex chars
      expect(secret64.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('should generate valid hex strings', () => {
      const secret = generateWebhookSecret();
      expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
    });
  });

  describe('validateWebhookConfig', () => {
    it('should validate correct configuration', () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => {
        validateWebhookConfig({ secret: 'a'.repeat(32), required: false });
      }).not.toThrow();

      expect(consoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
      consoleLog.mockRestore();
    });

    it('should throw error when secret is required but missing', () => {
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      expect(() => {
        validateWebhookConfig({ secret: '', required: true });
      }).toThrow('TELEGRAM_WEBHOOK_SECRET is required in production');
    });

    it('should throw error for secret that is too short', () => {
      expect(() => {
        validateWebhookConfig({ secret: 'tooshort', required: false });
      }).toThrow('too short');
    });

    it('should warn when secret is not configured', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      validateWebhookConfig({ secret: '', required: false });

      expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('⚠'));
      consoleWarn.mockRestore();
    });

    it('should accept secret of minimum length', () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => {
        validateWebhookConfig({ secret: 'a'.repeat(16), required: false });
      }).not.toThrow();

      consoleLog.mockRestore();
    });

    it('should use environment variable when not provided', () => {
      process.env.TELEGRAM_WEBHOOK_SECRET = 'a'.repeat(32);
      process.env.NODE_ENV = 'development';

      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      expect(() => {
        validateWebhookConfig();
      }).not.toThrow();

      consoleLog.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete webhook verification workflow', () => {
      const secret = generateWebhookSecret();

      // Simulate incoming webhook request
      const request = {
        headers: {
          'x-telegram-bot-api-secret-token': secret
        },
        body: { update_id: 123, message: { text: 'Hello' } }
      };

      // Verify the request
      const result = verifyWebhookRequest(request, { secret });
      expect(result.valid).toBe(true);

      // Verify with middleware
      const middleware = verifyTelegramWebhook({ secret, required: true });
      const next = vi.fn();

      middleware(request, {}, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle production vs development modes', () => {
      // Development mode - secret optional
      process.env.NODE_ENV = 'development';
      delete process.env.TELEGRAM_WEBHOOK_SECRET;

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => validateWebhookConfig()).not.toThrow();
      consoleWarn.mockRestore();

      // Production mode - secret required
      process.env.NODE_ENV = 'production';

      expect(() => validateWebhookConfig()).toThrow();
    });
  });
});
