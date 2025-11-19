/**
 * Unit Tests for Token Encryption Module
 *
 * Tests AES-256-GCM encryption/decryption functionality including:
 * - Encryption/decryption roundtrip
 * - Tamper detection
 * - Different IVs for same plaintext
 * - Invalid input handling
 * - Missing encryption key handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { encrypt, decrypt, generateKey } from '../../../src/utils/encryption.js';

describe('encryption', () => {
  let originalEncryptionKey;

  beforeEach(() => {
    // Save original encryption key
    originalEncryptionKey = process.env.ENCRYPTION_KEY;

    // Set a test encryption key (64 hex characters = 32 bytes)
    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  });

  afterEach(() => {
    // Restore original encryption key
    if (originalEncryptionKey) {
      process.env.ENCRYPTION_KEY = originalEncryptionKey;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);

      // Check format: iv:authTag:ciphertext (3 parts separated by colons)
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);

      // Each part should be valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });

    it('should generate different IVs for same plaintext', () => {
      const plaintext = 'my-secret-token';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // IVs should be different (first part before first colon)
      const iv1 = encrypted1.split(':')[0];
      const iv2 = encrypted2.split(':')[0];
      expect(iv1).not.toBe(iv2);
    });

    it('should throw error for empty plaintext', () => {
      expect(() => encrypt('')).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error for null plaintext', () => {
      expect(() => encrypt(null)).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error for undefined plaintext', () => {
      expect(() => encrypt(undefined)).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error for non-string plaintext', () => {
      expect(() => encrypt(123)).toThrow('Plaintext must be a non-empty string');
      expect(() => encrypt({ token: 'test' })).toThrow('Plaintext must be a non-empty string');
    });

    it('should throw error when ENCRYPTION_KEY is missing', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error for invalid ENCRYPTION_KEY format', () => {
      process.env.ENCRYPTION_KEY = 'not-hex-string';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a valid hexadecimal string');
    });

    it('should throw error for ENCRYPTION_KEY with wrong length', () => {
      // 30 bytes instead of 32
      process.env.ENCRYPTION_KEY = crypto.randomBytes(30).toString('hex');
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'ghp_' + 'a'.repeat(100);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'token-with-special-chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'token-with-unicode: 你好世界 🔐 こんにちは';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext (last part)
      const parts = encrypted.split(':');
      const tamperedCiphertext = Buffer.from(parts[2], 'base64');
      tamperedCiphertext[0] ^= 0xFF; // Flip bits in first byte
      parts[2] = tamperedCiphertext.toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed: data may have been tampered with');
    });

    it('should throw error for tampered auth tag', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);

      // Tamper with the auth tag (second part)
      const parts = encrypted.split(':');
      const tamperedTag = Buffer.from(parts[1], 'base64');
      tamperedTag[0] ^= 0xFF; // Flip bits in first byte
      parts[1] = tamperedTag.toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed: data may have been tampered with');
    });

    it('should throw error for tampered IV', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);

      // Tamper with the IV (first part)
      const parts = encrypted.split(':');
      const tamperedIv = Buffer.from(parts[0], 'base64');
      tamperedIv[0] ^= 0xFF; // Flip bits in first byte
      parts[0] = tamperedIv.toString('base64');
      const tampered = parts.join(':');

      expect(() => decrypt(tampered)).toThrow('Decryption failed: data may have been tampered with');
    });

    it('should throw error for invalid format (too few parts)', () => {
      expect(() => decrypt('invalid:format')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for invalid format (too many parts)', () => {
      expect(() => decrypt('too:many:parts:here')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for invalid base64 encoding', () => {
      // Invalid base64 characters will decode to wrong-length buffers
      // which will be caught by length validation
      expect(() => decrypt('@@@@:@@@@:@@@@')).toThrow(/Invalid (base64 encoding|IV length)/);
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decrypt('')).toThrow('Encrypted data must be a non-empty string');
    });

    it('should throw error for null encrypted data', () => {
      expect(() => decrypt(null)).toThrow('Encrypted data must be a non-empty string');
    });

    it('should throw error when ENCRYPTION_KEY is missing', () => {
      const encrypted = encrypt('test');
      delete process.env.ENCRYPTION_KEY;
      expect(() => decrypt(encrypted)).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error when decrypting with wrong key', () => {
      const plaintext = 'my-secret-token';
      const encrypted = encrypt(plaintext);

      // Change the encryption key
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

      expect(() => decrypt(encrypted)).toThrow('Decryption failed: data may have been tampered with');
    });

    it('should throw error for invalid IV length', () => {
      // Create encrypted data with wrong IV length
      const wrongIv = Buffer.from('short', 'utf8').toString('base64');
      const authTag = crypto.randomBytes(16).toString('base64');
      const ciphertext = crypto.randomBytes(32).toString('base64');
      const invalid = `${wrongIv}:${authTag}:${ciphertext}`;

      expect(() => decrypt(invalid)).toThrow('Invalid IV length');
    });

    it('should throw error for invalid auth tag length', () => {
      // Create encrypted data with wrong auth tag length
      const iv = crypto.randomBytes(12).toString('base64');
      const wrongAuthTag = Buffer.from('short', 'utf8').toString('base64');
      const ciphertext = crypto.randomBytes(32).toString('base64');
      const invalid = `${iv}:${wrongAuthTag}:${ciphertext}`;

      expect(() => decrypt(invalid)).toThrow('Invalid auth tag length');
    });
  });

  describe('encryption roundtrip', () => {
    it('should successfully roundtrip various GitHub PAT formats', () => {
      const pats = [
        'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
        'github_pat_11AAAAAA_zyxwvutsrqponmlkjihgfedcba9876543210',
        'ghp_' + 'x'.repeat(40)
      ];

      pats.forEach(pat => {
        const encrypted = encrypt(pat);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(pat);
      });
    });

    it('should handle multiple encrypt/decrypt cycles', () => {
      let data = 'my-secret-token';

      for (let i = 0; i < 10; i++) {
        const encrypted = encrypt(data);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(data);
        data = decrypted;
      }
    });
  });

  describe('generateKey', () => {
    it('should generate a valid encryption key', () => {
      const key = generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes = 64 hex characters

      // Should be valid hex
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should generate different keys each time', () => {
      const key1 = generateKey();
      const key2 = generateKey();
      const key3 = generateKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should generate keys usable for encryption', () => {
      const key = generateKey();
      process.env.ENCRYPTION_KEY = key;

      const plaintext = 'test-token';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('security properties', () => {
    it('should use different IVs for each encryption', () => {
      const plaintext = 'my-secret-token';
      const ivs = new Set();

      // Encrypt 100 times and check all IVs are unique
      for (let i = 0; i < 100; i++) {
        const encrypted = encrypt(plaintext);
        const iv = encrypted.split(':')[0];
        ivs.add(iv);
      }

      expect(ivs.size).toBe(100);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'my-secret-token';
      const ciphertexts = new Set();

      // Encrypt 100 times and check all ciphertexts are unique
      for (let i = 0; i < 100; i++) {
        const encrypted = encrypt(plaintext);
        ciphertexts.add(encrypted);
      }

      expect(ciphertexts.size).toBe(100);
    });

    it('should not leak plaintext in encrypted output', () => {
      const plaintext = 'my-secret-token-very-long-string-with-identifiable-content';
      const encrypted = encrypt(plaintext);

      // Check that plaintext doesn't appear in encrypted output
      expect(encrypted.toLowerCase()).not.toContain('secret');
      expect(encrypted.toLowerCase()).not.toContain('token');
      expect(encrypted.toLowerCase()).not.toContain('identifiable');
    });
  });
});
