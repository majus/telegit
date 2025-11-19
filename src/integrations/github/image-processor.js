/**
 * Image Processor for GitHub Issues
 * Processes Telegram images for inclusion in GitHub issues
 *
 * @module integrations/github/image-processor
 */

import { getSharedProxy } from '../../api/telegram-asset-proxy.js';
import logger from '../../utils/logger.js';

/**
 * Image Processor class
 * Handles image extraction from Telegram messages and conversion for GitHub
 */
export class ImageProcessor {
  constructor(telegramBot = null, proxyBaseUrl = null) {
    this.bot = telegramBot;
    this.proxyBaseUrl = proxyBaseUrl;
  }

  /**
   * Initialize the image processor
   * @param {Object} telegramBot - Telegraf bot instance
   * @param {string} proxyBaseUrl - Base URL for the asset proxy server
   */
  initialize(telegramBot, proxyBaseUrl) {
    this.bot = telegramBot;
    this.proxyBaseUrl = proxyBaseUrl;

    if (!this.bot) {
      throw new Error('Telegram bot instance is required');
    }

    if (!this.proxyBaseUrl) {
      throw new Error('Proxy base URL is required');
    }
  }

  /**
   * Extract images from a Telegram message
   * @param {Object} message - Telegram message object
   * @returns {Promise<Array>} Array of image metadata
   */
  async extractImages(message) {
    const images = [];

    // Check for photo array (Telegram sends multiple sizes)
    if (message.photo && Array.isArray(message.photo)) {
      // Get the largest photo
      const largestPhoto = message.photo.reduce((prev, current) => {
        return prev.file_size > current.file_size ? prev : current;
      });

      const imageInfo = await this._processPhoto(largestPhoto);
      if (imageInfo) {
        images.push(imageInfo);
      }
    }

    // Check for single document/file (if it's an image)
    if (message.document && this._isImageMimeType(message.document.mime_type)) {
      const imageInfo = await this._processDocument(message.document);
      if (imageInfo) {
        images.push(imageInfo);
      }
    }

    // Check for sticker (if we want to include it)
    if (message.sticker && message.sticker.is_video === false) {
      const imageInfo = await this._processSticker(message.sticker);
      if (imageInfo) {
        images.push(imageInfo);
      }
    }

    return images;
  }

  /**
   * Process a photo object from Telegram
   * @param {Object} photo - Telegram photo object
   * @returns {Promise<Object>} Image metadata
   * @private
   */
  async _processPhoto(photo) {
    try {
      if (!this.bot) {
        throw new Error('Bot not initialized');
      }

      // Get file info from Telegram
      const file = await this.bot.telegram.getFile(photo.file_id);

      if (!file.file_path) {
        throw new Error('File path not available from Telegram');
      }

      // Generate proxy URL
      const proxy = getSharedProxy();
      const proxyUrl = proxy.generateProxyUrl(file.file_path, this.proxyBaseUrl);

      return {
        type: 'photo',
        fileId: photo.file_id,
        filePath: file.file_path,
        proxyUrl,
        width: photo.width,
        height: photo.height,
        fileSize: photo.file_size,
      };
    } catch (error) {
      logger.error({ err: error, fileId: photo.file_id }, 'Failed to process photo');
      return null;
    }
  }

  /**
   * Process a document object from Telegram
   * @param {Object} document - Telegram document object
   * @returns {Promise<Object>} Image metadata
   * @private
   */
  async _processDocument(document) {
    try {
      if (!this.bot) {
        throw new Error('Bot not initialized');
      }

      // Get file info from Telegram
      const file = await this.bot.telegram.getFile(document.file_id);

      if (!file.file_path) {
        throw new Error('File path not available from Telegram');
      }

      // Generate proxy URL
      const proxy = getSharedProxy();
      const proxyUrl = proxy.generateProxyUrl(file.file_path, this.proxyBaseUrl);

      return {
        type: 'document',
        fileId: document.file_id,
        filePath: file.file_path,
        proxyUrl,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: document.file_size,
      };
    } catch (error) {
      logger.error({ err: error, fileId: document.file_id, fileName: document.file_name }, 'Failed to process document');
      return null;
    }
  }

  /**
   * Process a sticker object from Telegram
   * @param {Object} sticker - Telegram sticker object
   * @returns {Promise<Object>} Image metadata
   * @private
   */
  async _processSticker(sticker) {
    try {
      if (!this.bot) {
        throw new Error('Bot not initialized');
      }

      // Get file info from Telegram
      const file = await this.bot.telegram.getFile(sticker.file_id);

      if (!file.file_path) {
        throw new Error('File path not available from Telegram');
      }

      // Generate proxy URL
      const proxy = getSharedProxy();
      const proxyUrl = proxy.generateProxyUrl(file.file_path, this.proxyBaseUrl);

      return {
        type: 'sticker',
        fileId: sticker.file_id,
        filePath: file.file_path,
        proxyUrl,
        emoji: sticker.emoji,
        width: sticker.width,
        height: sticker.height,
        fileSize: sticker.file_size,
      };
    } catch (error) {
      logger.error({ err: error, fileId: sticker.file_id, emoji: sticker.emoji }, 'Failed to process sticker');
      return null;
    }
  }

  /**
   * Check if MIME type is an image
   * @param {string} mimeType - MIME type string
   * @returns {boolean}
   * @private
   */
  _isImageMimeType(mimeType) {
    const imageMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    return imageMimeTypes.includes(mimeType);
  }

  /**
   * Generate markdown image syntax for GitHub
   * @param {Object} imageInfo - Image metadata object
   * @param {string} [alt] - Alt text for the image
   * @returns {string} Markdown image syntax
   */
  generateMarkdownImage(imageInfo, alt = 'Image') {
    if (!imageInfo || !imageInfo.proxyUrl) {
      return '';
    }

    // Use file name as alt text if available
    const altText = imageInfo.fileName || alt;

    return `![${altText}](${imageInfo.proxyUrl})`;
  }

  /**
   * Process message and append images to body text
   * @param {Object} message - Telegram message object
   * @param {string} bodyText - Existing body text
   * @returns {Promise<string>} Body text with appended images
   */
  async processMessageImages(message, bodyText) {
    const images = await this.extractImages(message);

    if (images.length === 0) {
      return bodyText;
    }

    // Build markdown for all images
    const imageMarkdown = images
      .map((img, index) => {
        const alt = img.fileName || `Image ${index + 1}`;
        return this.generateMarkdownImage(img, alt);
      })
      .join('\n\n');

    // Append images to body with a separator
    if (bodyText && bodyText.trim()) {
      return `${bodyText}\n\n---\n\n${imageMarkdown}`;
    } else {
      return imageMarkdown;
    }
  }

  /**
   * Replace Telegram URLs in text with proxy URLs
   * This is useful if the text already contains Telegram file URLs
   * @param {string} text - Text containing Telegram URLs
   * @param {Object} message - Telegram message object (for extracting file IDs)
   * @returns {Promise<string>} Text with replaced URLs
   */
  async replaceTeleg ramUrls(text, message) {
    // Extract all Telegram URLs from text
    const telegramUrlRegex = /https:\/\/api\.telegram\.org\/file\/bot[a-zA-Z0-9:_-]+\/[^\s)]+/g;
    const urls = text.match(telegramUrlRegex);

    if (!urls || urls.length === 0) {
      return text;
    }

    // Extract images from message to get file paths
    const images = await this.extractImages(message);
    let updatedText = text;

    // Replace each URL with proxy URL
    for (const url of urls) {
      // Extract file path from URL
      const pathMatch = url.match(/\/file\/bot[^/]+\/(.+)$/);
      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];

        // Find matching image info
        const imageInfo = images.find((img) => img.filePath === filePath);

        if (imageInfo && imageInfo.proxyUrl) {
          updatedText = updatedText.replace(url, imageInfo.proxyUrl);
        }
      }
    }

    return updatedText;
  }

  /**
   * Get image count from a message
   * @param {Object} message - Telegram message object
   * @returns {number} Number of images in the message
   */
  getImageCount(message) {
    let count = 0;

    if (message.photo && Array.isArray(message.photo)) {
      count++;
    }

    if (message.document && this._isImageMimeType(message.document.mime_type)) {
      count++;
    }

    if (message.sticker && message.sticker.is_video === false) {
      count++;
    }

    return count;
  }

  /**
   * Check if a message has images
   * @param {Object} message - Telegram message object
   * @returns {boolean}
   */
  hasImages(message) {
    return this.getImageCount(message) > 0;
  }
}

/**
 * Singleton image processor instance
 */
let sharedProcessorInstance = null;

/**
 * Get or create shared image processor instance
 * @param {Object} [telegramBot] - Telegraf bot instance
 * @param {string} [proxyBaseUrl] - Proxy base URL
 * @returns {ImageProcessor} Shared processor instance
 */
export function getSharedImageProcessor(telegramBot = null, proxyBaseUrl = null) {
  if (!sharedProcessorInstance) {
    sharedProcessorInstance = new ImageProcessor();
    if (telegramBot && proxyBaseUrl) {
      sharedProcessorInstance.initialize(telegramBot, proxyBaseUrl);
    }
  }

  return sharedProcessorInstance;
}

/**
 * Create a new image processor instance
 * @param {Object} [telegramBot] - Telegraf bot instance
 * @param {string} [proxyBaseUrl] - Proxy base URL
 * @returns {ImageProcessor} New processor instance
 */
export function createImageProcessor(telegramBot = null, proxyBaseUrl = null) {
  const processor = new ImageProcessor();
  if (telegramBot && proxyBaseUrl) {
    processor.initialize(telegramBot, proxyBaseUrl);
  }
  return processor;
}

/**
 * Convenience function to process images from a message
 * @param {Object} message - Telegram message object
 * @param {string} bodyText - Issue body text
 * @param {Object} telegramBot - Telegraf bot instance
 * @param {string} proxyBaseUrl - Proxy base URL
 * @returns {Promise<string>} Body text with images appended
 */
export async function processImagesForIssue(
  message,
  bodyText,
  telegramBot,
  proxyBaseUrl
) {
  const processor = getSharedImageProcessor(telegramBot, proxyBaseUrl);
  return await processor.processMessageImages(message, bodyText);
}
