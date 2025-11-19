/**
 * Telegram Asset Proxy
 * Transparent proxy for Telegram file requests to hide bot token from public URLs
 *
 * @module api/telegram-asset-proxy
 */

import { getConfig } from '../../config/env.js';
import https from 'https';

/**
 * Telegram Asset Proxy class
 * Provides secure transparent proxying of Telegram files without exposing bot token
 */
export class TelegramAssetProxy {
  constructor(botToken = null) {
    this.botToken = botToken;
  }

  /**
   * Initialize proxy with bot token
   * @param {string} [botToken] - Telegram bot token (defaults to config)
   */
  initialize(botToken = null) {
    if (botToken) {
      this.botToken = botToken;
    } else {
      const config = getConfig();
      this.botToken = config.telegram.botToken;
    }

    if (!this.botToken) {
      throw new Error('Telegram bot token is required for asset proxy');
    }
  }

  /**
   * Construct full Telegram file URL from file path
   * @param {string} filePath - Telegram file path (from getFile API)
   * @returns {string} Full Telegram file URL (HTTPS only)
   * @private
   */
  _buildTelegramUrl(filePath) {
    if (!this.botToken) {
      throw new Error('Asset proxy not initialized. Call initialize() first.');
    }

    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    return `https://api.telegram.org/file/bot${this.botToken}/${cleanPath}`;
  }

  /**
   * Extract file path from HTTP request
   * @param {string} url - Request URL
   * @returns {string} Decoded file path
   * @private
   */
  _extractFilePath(url) {
    // Expecting URL format: /api/telegram-asset/:filePath
    return decodeURIComponent(url.split('/').pop());
  }

  /**
   * Generate proxy URL for a Telegram file path
   * This URL can be safely embedded in public content (like GitHub issues)
   * @param {string} filePath - Telegram file path
   * @param {string} baseUrl - Base URL of the proxy server
   * @returns {string} Public proxy URL
   */
  generateProxyUrl(filePath, baseUrl) {
    // Encode the file path for URL safety
    const encodedPath = encodeURIComponent(filePath);
    return `${baseUrl}/api/telegram-asset/${encodedPath}`;
  }

  /**
   * Express/HTTP handler for proxy requests
   * Streams responses directly from Telegram to client without buffering
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @returns {Promise<void>}
   */
  async handleRequest(req, res) {
    try {
      // Extract file path from request
      const filePath = req.params?.filePath || this._extractFilePath(req.url);

      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File path is required' }));
        return;
      }

      // Build Telegram URL and stream response
      const url = this._buildTelegramUrl(filePath);

      return new Promise((resolve, reject) => {
        https.get(url, (telegramResponse) => {
          // Handle non-200 responses
          if (telegramResponse.statusCode !== 200) {
            res.writeHead(telegramResponse.statusCode, telegramResponse.headers);
            telegramResponse.pipe(res);
            telegramResponse.on('end', resolve);
            return;
          }

          // Pass through Telegram's response headers
          const headers = { ...telegramResponse.headers };
          headers['X-Content-Type-Options'] = 'nosniff';

          res.writeHead(200, headers);

          // Stream directly - no memory buffering!
          telegramResponse.pipe(res);

          telegramResponse.on('end', resolve);
          telegramResponse.on('error', (error) => {
            console.error('Telegram stream error:', error);
            reject(error);
          });
        }).on('error', (error) => {
          console.error('Telegram request error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Failed to fetch asset',
              message: error.message,
            })
          );
          reject(error);
        });
      });
    } catch (error) {
      console.error('Telegram asset proxy error:', error);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'Failed to fetch asset',
          message: error.message,
        })
      );
    }
  }
}

/**
 * Singleton proxy instance
 */
let sharedProxyInstance = null;

/**
 * Get or create shared proxy instance
 * @param {string} [botToken] - Optional bot token
 * @returns {TelegramAssetProxy} Shared proxy instance
 */
export function getSharedProxy(botToken = null) {
  if (!sharedProxyInstance) {
    sharedProxyInstance = new TelegramAssetProxy(botToken);
    sharedProxyInstance.initialize();
  }

  return sharedProxyInstance;
}

/**
 * Create a new proxy instance
 * @param {string} [botToken] - Optional bot token
 * @returns {TelegramAssetProxy} New proxy instance
 */
export function createProxy(botToken = null) {
  const proxy = new TelegramAssetProxy(botToken);
  proxy.initialize();
  return proxy;
}

/**
 * Express middleware factory for Telegram asset proxy
 * Usage: app.get('/api/telegram-asset/:filePath', telegramAssetProxyMiddleware())
 * @param {string} [botToken] - Optional bot token
 * @returns {Function} Express middleware
 */
export function telegramAssetProxyMiddleware(botToken = null) {
  const proxy = getSharedProxy(botToken);

  return async (req, res) => {
    await proxy.handleRequest(req, res);
  };
}
