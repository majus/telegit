/**
 * Telegram Asset Proxy
 * Proxies Telegram file requests to hide bot token from public URLs
 *
 * @module api/telegram-asset-proxy
 */

import { getConfig } from '../../config/env.js';
import https from 'https';
import http from 'http';

/**
 * Telegram Asset Proxy class
 * Provides secure proxying of Telegram files without exposing bot token
 */
export class TelegramAssetProxy {
  constructor(botToken = null) {
    this.botToken = botToken;
    this.cache = new Map();
    this.cacheMaxAge = 3600000; // 1 hour in milliseconds
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
   * @returns {string} Full Telegram file URL
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
   * Fetch file from Telegram servers
   * @param {string} filePath - Telegram file path
   * @returns {Promise<Buffer>} File data as Buffer
   * @private
   */
  async _fetchFromTelegram(filePath) {
    const url = this._buildTelegramUrl(filePath);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      protocol
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to fetch Telegram asset. Status: ${response.statusCode}`
              )
            );
            return;
          }

          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', reject);
    });
  }

  /**
   * Get file from cache or fetch from Telegram
   * @param {string} filePath - Telegram file path
   * @returns {Promise<{data: Buffer, contentType: string}>} File data and content type
   */
  async getFile(filePath) {
    // Check cache
    const cached = this.cache.get(filePath);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return {
        data: cached.data,
        contentType: cached.contentType,
      };
    }

    // Fetch from Telegram
    const data = await this._fetchFromTelegram(filePath);

    // Determine content type from file extension
    const contentType = this._getContentType(filePath);

    // Cache the result
    this.cache.set(filePath, {
      data,
      contentType,
      timestamp: Date.now(),
    });

    return { data, contentType };
  }

  /**
   * Determine content type from file path
   * @param {string} filePath - File path
   * @returns {string} MIME content type
   * @private
   */
  _getContentType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();

    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      pdf: 'application/pdf',
      txt: 'text/plain',
      json: 'application/json',
    };

    return mimeTypes[ext] || 'application/octet-stream';
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
   * Use this in your web server to handle proxy requests
   * @param {Object} req - HTTP request object
   * @param {Object} res - HTTP response object
   * @returns {Promise<void>}
   */
  async handleRequest(req, res) {
    try {
      // Extract file path from request
      // Expecting URL format: /api/telegram-asset/:filePath
      const filePath = decodeURIComponent(req.params.filePath || req.url.split('/').pop());

      if (!filePath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File path is required' }));
        return;
      }

      // Get file from cache or Telegram
      const { data, contentType } = await this.getFile(filePath);

      // Set caching headers
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Cache-Control': `public, max-age=${this.cacheMaxAge / 1000}`,
        'X-Content-Type-Options': 'nosniff',
      });

      // Stream response
      res.end(data);
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

  /**
   * Clear the asset cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Remove expired items from cache
   */
  pruneCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    let totalSize = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const value of this.cache.values()) {
      totalSize += value.data.length;
      if (now - value.timestamp >= this.cacheMaxAge) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      totalBytes: totalSize,
      expiredItems: expiredCount,
    };
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

    // Set up cache pruning interval (every 10 minutes)
    setInterval(() => {
      sharedProxyInstance.pruneCache();
    }, 600000);
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
