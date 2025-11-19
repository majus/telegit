/**
 * Webhook Signature Verification Module
 *
 * Verifies Telegram webhook signatures to ensure requests are authentic.
 * Uses HMAC-SHA256 for signature validation.
 *
 * Security features:
 * - HMAC-SHA256 signature verification
 * - Constant-time comparison to prevent timing attacks
 * - Secret token validation
 * - Request header validation
 */

import crypto from 'crypto';

/**
 * Verify Telegram webhook secret token
 *
 * Telegram supports a simple secret token that can be sent with webhooks.
 * This provides basic authentication for webhook endpoints.
 *
 * @param {string} receivedToken - Token received in X-Telegram-Bot-Api-Secret-Token header
 * @param {string} expectedToken - Expected secret token from environment
 * @returns {boolean} True if token is valid
 *
 * @example
 * const isValid = verifySecretToken(
 *   req.headers['x-telegram-bot-api-secret-token'],
 *   process.env.TELEGRAM_WEBHOOK_SECRET
 * );
 */
export function verifySecretToken(receivedToken, expectedToken) {
  if (!expectedToken) {
    // If no secret token is configured, skip validation
    // This is acceptable for development but should be enforced in production
    return true;
  }

  if (!receivedToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedToken),
      Buffer.from(expectedToken)
    );
  } catch (error) {
    // Buffers have different lengths
    return false;
  }
}

/**
 * Compute HMAC signature for webhook data
 *
 * Telegram doesn't provide built-in HMAC signatures for webhooks,
 * but this function can be used if implementing custom webhook authentication
 * or for other webhook providers that use HMAC.
 *
 * @param {string|Buffer} data - Data to sign
 * @param {string} secret - Secret key for HMAC
 * @returns {string} Hex-encoded HMAC signature
 *
 * @example
 * const signature = computeHmacSignature(JSON.stringify(webhookData), secret);
 */
export function computeHmacSignature(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature
 *
 * Verifies that a received signature matches the computed signature for given data.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param {string|Buffer} data - Data that was signed
 * @param {string} receivedSignature - Signature received with the request
 * @param {string} secret - Secret key for HMAC
 * @returns {boolean} True if signature is valid
 *
 * @example
 * const isValid = verifyHmacSignature(
 *   requestBody,
 *   req.headers['x-hub-signature-256'],
 *   process.env.WEBHOOK_SECRET
 * );
 */
export function verifyHmacSignature(data, receivedSignature, secret) {
  if (!receivedSignature || !secret) {
    return false;
  }

  const computedSignature = computeHmacSignature(data, secret);

  // Use constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature),
      Buffer.from(computedSignature)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Middleware for Express/Connect to verify Telegram webhook secret token
 *
 * @param {Object} options - Configuration options
 * @param {string} options.secret - Expected secret token (optional, reads from env if not provided)
 * @param {string} options.header - Header name containing the token (default: 'x-telegram-bot-api-secret-token')
 * @param {boolean} options.required - Whether to reject requests without a token (default: false in dev, true in production)
 * @returns {Function} Express middleware function
 *
 * @example
 * app.use('/webhook', verifyTelegramWebhook({
 *   secret: process.env.TELEGRAM_WEBHOOK_SECRET,
 *   required: process.env.NODE_ENV === 'production'
 * }));
 */
export function verifyTelegramWebhook(options = {}) {
  const {
    secret = process.env.TELEGRAM_WEBHOOK_SECRET,
    header = 'x-telegram-bot-api-secret-token',
    required = process.env.NODE_ENV === 'production'
  } = options;

  return function webhookVerificationMiddleware(req, res, next) {
    // If secret is not configured and not required, allow request
    if (!secret && !required) {
      return next();
    }

    // Get the received token
    const receivedToken = req.headers[header.toLowerCase()];

    // If token is missing
    if (!receivedToken) {
      // If required, reject
      if (required) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing webhook secret token'
        });
      }
      // If not required, allow
      return next();
    }

    // Token is provided - verify it if secret is configured
    if (secret && !verifySecretToken(receivedToken, secret)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook secret token'
      });
    }

    next();
  };
}

/**
 * Verify webhook request manually (non-middleware usage)
 *
 * @param {Object} request - Request object with headers
 * @param {Object} options - Verification options
 * @param {string} options.secret - Expected secret token
 * @param {string} options.header - Header name (default: 'x-telegram-bot-api-secret-token')
 * @returns {{valid: boolean, error?: string}} Verification result
 *
 * @example
 * const result = verifyWebhookRequest(req, {
 *   secret: process.env.TELEGRAM_WEBHOOK_SECRET
 * });
 * if (!result.valid) {
 *   return res.status(401).json({ error: result.error });
 * }
 */
export function verifyWebhookRequest(request, options = {}) {
  const {
    secret = process.env.TELEGRAM_WEBHOOK_SECRET,
    header = 'x-telegram-bot-api-secret-token'
  } = options;

  if (!secret) {
    return {
      valid: false,
      error: 'Webhook secret not configured'
    };
  }

  const receivedToken = request.headers?.[header.toLowerCase()];

  if (!receivedToken) {
    return {
      valid: false,
      error: 'Missing webhook secret token in request headers'
    };
  }

  if (!verifySecretToken(receivedToken, secret)) {
    return {
      valid: false,
      error: 'Invalid webhook secret token'
    };
  }

  return { valid: true };
}

/**
 * Generate a random webhook secret token
 *
 * @param {number} length - Length of the token (default: 32)
 * @returns {string} Random hex string
 *
 * @example
 * const secret = generateWebhookSecret();
 * console.log('Set TELEGRAM_WEBHOOK_SECRET=' + secret);
 */
export function generateWebhookSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate webhook configuration at startup
 *
 * @param {Object} config - Configuration object
 * @param {string} config.secret - Webhook secret
 * @param {boolean} config.required - Whether secret is required
 * @throws {Error} If configuration is invalid
 *
 * @example
 * validateWebhookConfig({
 *   secret: process.env.TELEGRAM_WEBHOOK_SECRET,
 *   required: process.env.NODE_ENV === 'production'
 * });
 */
export function validateWebhookConfig(config = {}) {
  const {
    secret = process.env.TELEGRAM_WEBHOOK_SECRET,
    required = process.env.NODE_ENV === 'production'
  } = config;

  if (required && !secret) {
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET is required in production. ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (secret && secret.length < 16) {
    throw new Error(
      'TELEGRAM_WEBHOOK_SECRET is too short. Minimum length is 16 characters. ' +
      'Generate a new one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (secret) {
    console.log('✓ Webhook security configuration validated');
  } else {
    console.warn('⚠ Webhook secret not configured - requests will not be authenticated');
  }
}

export default {
  verifySecretToken,
  computeHmacSignature,
  verifyHmacSignature,
  verifyTelegramWebhook,
  verifyWebhookRequest,
  generateWebhookSecret,
  validateWebhookConfig
};
