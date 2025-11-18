/**
 * Encryption Utility
 * Provides AES-256-GCM encryption/decryption for sensitive data (GitHub PATs)
 */

import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment
 * Key must be 64 hex characters (32 bytes) for AES-256
 * @returns {Buffer} Encryption key
 * @throws {Error} If ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('ENCRYPTION_KEY must contain only hexadecimal characters');
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @returns {string} Encrypted text in format: iv:authTag:ciphertext (all hex encoded)
 * @throws {Error} If encryption fails
 */
export function encrypt(plaintext) {
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty');
  }

  try {
    const key = getEncryptionKey();

    // Generate random IV for each encryption (important for security)
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the plaintext
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:ciphertext (all hex encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * @param {string} encryptedData - Encrypted text in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails or data is tampered
 */
export function decrypt(encryptedData) {
  if (!encryptedData) {
    throw new Error('Encrypted data cannot be empty');
  }

  try {
    const key = getEncryptionKey();

    // Parse encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, ciphertext] = parts;

    // Convert from hex
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid authentication tag length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the ciphertext
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  } catch (error) {
    // Don't expose internal error details for security
    if (error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Data authentication failed - possible tampering detected');
    }
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a random encryption key (for initial setup)
 * @returns {string} 64 character hex string (32 bytes)
 */
export function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Validate that an encryption key is properly formatted
 * @param {string} key - Key to validate
 * @returns {boolean} True if key is valid
 */
export function validateKey(key) {
  if (!key) return false;
  if (key.length !== 64) return false;
  if (!/^[0-9a-fA-F]{64}$/.test(key)) return false;
  return true;
}

export default {
  encrypt,
  decrypt,
  generateKey,
  validateKey,
};
