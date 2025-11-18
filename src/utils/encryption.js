/**
 * Token Encryption Module
 *
 * Provides AES-256-GCM encryption and decryption for sensitive tokens
 * (e.g., GitHub Personal Access Tokens).
 *
 * Security features:
 * - AES-256-GCM encryption algorithm
 * - Random IV (Initialization Vector) for each encryption
 * - Authentication tag for tamper detection
 * - Constant-time comparison for auth tags
 */

import crypto from 'crypto';

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Get encryption key from environment variable
 * @returns {Buffer} Encryption key
 * @throws {Error} If ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey() {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Remove any whitespace
  const cleanKey = keyHex.replace(/\s/g, '');

  // Validate hex format and length
  if (!/^[0-9a-fA-F]+$/.test(cleanKey)) {
    throw new Error('ENCRYPTION_KEY must be a valid hexadecimal string');
  }

  const key = Buffer.from(cleanKey, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`);
  }

  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param {string} plaintext - The text to encrypt
 * @returns {string} Base64-encoded encrypted data in format: iv:authTag:ciphertext
 * @throws {Error} If encryption fails or key is invalid
 *
 * @example
 * const encrypted = encrypt('my-secret-token');
 * // Returns: "vI7q3K...==:8hF2x...==:9jK4p...=="
 */
export function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string');
  }

  const key = getEncryptionKey();

  // Generate random IV for this encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and ciphertext with colons
  // Format: iv:authTag:ciphertext (all base64-encoded)
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext
  ].join(':');
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param {string} encryptedData - Base64-encoded encrypted data in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 * @throws {Error} If decryption fails, data is tampered, or format is invalid
 *
 * @example
 * const decrypted = decrypt('vI7q3K...==:8hF2x...==:9jK4p...==');
 * // Returns: "my-secret-token"
 */
export function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Encrypted data must be a non-empty string');
  }

  const key = getEncryptionKey();

  // Split the encrypted data
  const parts = encryptedData.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format. Expected format: iv:authTag:ciphertext');
  }

  const [ivBase64, authTagBase64, ciphertext] = parts;

  // Decode from base64
  let iv, authTag;
  try {
    iv = Buffer.from(ivBase64, 'base64');
    authTag = Buffer.from(authTagBase64, 'base64');
  } catch (error) {
    throw new Error('Invalid base64 encoding in encrypted data');
  }

  // Validate IV and auth tag lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length. Expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (error) {
    // Authentication failed - data was tampered with
    throw new Error('Decryption failed: data may have been tampered with');
  }
}

/**
 * Generate a random encryption key
 * This is a utility function for initial setup
 *
 * @returns {string} Random 64-character hex string (32 bytes)
 *
 * @example
 * const key = generateKey();
 * // Returns: "a1b2c3d4e5f6..."
 */
export function generateKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
