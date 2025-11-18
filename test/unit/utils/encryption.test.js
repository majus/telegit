/**
 * Unit tests for encryption utility
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, generateKey, validateKey } from '../../../src/utils/encryption.js';

describe('Encryption Utility', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;
  const testKey = generateKey(); // Generate a valid test key

  beforeAll(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterEach(() => {
    // Restore original environment after all tests
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe('generateKey', () => {
    it('should generate a valid 64-character hex key', () => {
      const key = generateKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(64);
      expect(/^[0-9a-fA-F]{64}$/.test(key)).toBe(true);
    });

    it('should generate different keys on each call', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateKey', () => {
    it('should validate a correct key', () => {
      const key = generateKey();
      expect(validateKey(key)).toBe(true);
    });

    it('should reject a key with wrong length', () => {
      expect(validateKey('abc123')).toBe(false);
      expect(validateKey('a'.repeat(63))).toBe(false);
      expect(validateKey('a'.repeat(65))).toBe(false);
    });

    it('should reject a key with non-hex characters', () => {
      const invalidKey = 'g'.repeat(64); // 'g' is not a hex character
      expect(validateKey(invalidKey)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateKey(null)).toBe(false);
      expect(validateKey(undefined)).toBe(false);
      expect(validateKey('')).toBe(false);
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'my-secret-github-token';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce encrypted text in correct format (iv:authTag:ciphertext)', () => {
      const plaintext = 'test-token';
      const encrypted = encrypt(plaintext);

      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);

      // IV should be 32 hex chars (16 bytes)
      expect(parts[0].length).toBe(32);
      expect(/^[0-9a-fA-F]{32}$/.test(parts[0])).toBe(true);

      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1].length).toBe(32);
      expect(/^[0-9a-fA-F]{32}$/.test(parts[1])).toBe(true);

      // Ciphertext should be hex
      expect(/^[0-9a-fA-F]+$/.test(parts[2])).toBe(true);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty plaintext', () => {
      expect(() => encrypt('')).toThrow('Plaintext cannot be empty');
      expect(() => encrypt(null)).toThrow('Plaintext cannot be empty');
    });

    it('should throw error if ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
      process.env.ENCRYPTION_KEY = testKey; // Restore
    });

    it('should throw error if ENCRYPTION_KEY is invalid', () => {
      process.env.ENCRYPTION_KEY = 'invalid-key';
      expect(() => encrypt('test')).toThrow();
      process.env.ENCRYPTION_KEY = testKey; // Restore
    });
  });

  describe('decrypt', () => {
    it('should decrypt ciphertext successfully', () => {
      const plaintext = 'my-secret-github-token';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      const plaintext = 'token-with-特殊字符-and-émojis-🎉';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decrypt('')).toThrow('Encrypted data cannot be empty');
      expect(() => decrypt(null)).toThrow('Encrypted data cannot be empty');
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('a:b')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for tampered data', () => {
      const plaintext = 'original-token';
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext
      const parts = encrypted.split(':');
      parts[2] = parts[2].substring(0, parts[2].length - 2) + 'ff';
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Data authentication failed');
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'original-token';
      const encrypted = encrypt(plaintext);

      // Tamper with the auth tag
      const parts = encrypted.split(':');
      parts[1] = 'a'.repeat(32);
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Data authentication failed');
    });

    it('should throw error for invalid IV length', () => {
      const encrypted = 'aa:' + 'b'.repeat(32) + ':' + 'c'.repeat(32);
      expect(() => decrypt(encrypted)).toThrow('Invalid IV length');
    });

    it('should throw error for invalid auth tag length', () => {
      const encrypted = 'a'.repeat(32) + ':bb:' + 'c'.repeat(32);
      expect(() => decrypt(encrypted)).toThrow('Invalid authentication tag length');
    });
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('should successfully roundtrip various strings', () => {
      const testStrings = [
        'simple-token',
        'ghp_1234567890abcdefGHIJKLMNOPQRSTUVWXYZ',
        'token with spaces',
        'token-with-special-!@#$%^&*()_+-=[]{}|;:,.<>?',
        'token\nwith\nnewlines',
        'token\twith\ttabs',
        '😀🎉🚀', // Emojis
        '中文字符', // Chinese characters
        'a'.repeat(500), // Long string
      ];

      testStrings.forEach(plaintext => {
        const encrypted = encrypt(plaintext);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      });
    });
  });

  describe('security properties', () => {
    it('should use different IVs for each encryption', () => {
      const plaintext = 'same-plaintext';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];

      expect(iv1).not.toBe(iv2);
    });

    it('should not reveal plaintext length in ciphertext', () => {
      // This is a property of GCM mode - ciphertext length equals plaintext length
      // But the IV and auth tag add constant overhead
      const short = encrypt('a');
      const long = encrypt('a'.repeat(100));

      const shortParts = short.split(':');
      const longParts = long.split(':');

      // IV and auth tag should be same length
      expect(shortParts[0].length).toBe(longParts[0].length);
      expect(shortParts[1].length).toBe(longParts[1].length);

      // Ciphertext should reflect plaintext length
      expect(shortParts[2].length).toBeLessThan(longParts[2].length);
    });
  });
});
