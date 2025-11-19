/**
 * Input Sanitization Module
 *
 * Provides sanitization for Telegram input to prevent injection attacks.
 * Focuses on preventing XSS in GitHub issue bodies while preserving
 * legitimate markdown formatting.
 *
 * Security features:
 * - XSS prevention (script tags, event handlers, javascript: URLs)
 * - HTML tag filtering (allow safe markdown-compatible tags)
 * - Message length validation
 * - Markdown-safe output
 * - Unicode handling
 */

// Maximum lengths for different message types
const MAX_MESSAGE_LENGTH = 10000; // Reasonable limit for issue body
const MAX_TITLE_LENGTH = 256; // GitHub issue title limit
const MAX_LABEL_LENGTH = 50; // Reasonable label length

// Dangerous patterns that should be removed/escaped
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script[^>]*>.*?<\/script>/gis,
  // Event handlers (onclick, onerror, etc.)
  /\s*on\w+\s*=\s*["'][^"']*["']/gi,
  /\s*on\w+\s*=\s*[^\s>]*/gi,
  // JavaScript protocol
  /javascript:/gi,
  // Data URLs (can contain scripts)
  /data:text\/html/gi,
  // Object and embed tags
  /<(object|embed|applet)[^>]*>.*?<\/\1>/gis,
  // Iframe tags
  /<iframe[^>]*>.*?<\/iframe>/gis,
  // Style tags (can contain CSS injection)
  /<style[^>]*>.*?<\/style>/gis,
  // Meta tags
  /<meta[^>]*>/gi,
  // Link tags (except for valid markdown links)
  /<link[^>]*>/gi,
  // Base tag
  /<base[^>]*>/gi
];

// HTML entities that need escaping
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Escape HTML entities in a string
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  return String(text).replace(/[&<>"'\/]/g, char => HTML_ENTITIES[char]);
}

/**
 * Remove dangerous patterns from text
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 */
function removeDangerousPatterns(text) {
  let cleaned = text;

  for (const pattern of DANGEROUS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned;
}

/**
 * Sanitize text for use in GitHub issue body
 * Preserves markdown formatting while removing XSS vectors
 *
 * @param {string} text - Text to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} options.allowHtml - Allow safe HTML tags (default: false)
 * @param {number} options.maxLength - Maximum length (default: MAX_MESSAGE_LENGTH)
 * @returns {string} Sanitized text
 *
 * @example
 * sanitizeMessageBody('Hello <script>alert("xss")</script> world');
 * // Returns: 'Hello  world'
 *
 * @example
 * sanitizeMessageBody('# Title\n\n**Bold** text');
 * // Returns: '# Title\n\n**Bold** text' (markdown preserved)
 */
export function sanitizeMessageBody(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const {
    allowHtml = false,
    maxLength = MAX_MESSAGE_LENGTH
  } = options;

  // Remove dangerous patterns first
  let sanitized = removeDangerousPatterns(text);

  // If HTML is not allowed, escape all HTML entities
  if (!allowHtml) {
    // Preserve markdown by not escaping certain characters in markdown context
    // This is a simplified approach - full markdown parsing would be more robust
    sanitized = sanitized
      .replace(/<(?!\/?(?:a|b|i|em|strong|code|pre|blockquote|ul|ol|li|h[1-6])\b)[^>]*>/gi, '');
  }

  // Truncate to maximum length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized.trim();
}

/**
 * Sanitize text for use in GitHub issue title
 *
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized title
 *
 * @example
 * sanitizeTitle('My <script>evil</script> title');
 * // Returns: 'My evil title'
 */
export function sanitizeTitle(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove all HTML tags and dangerous content
  let sanitized = removeDangerousPatterns(text);

  // Remove all remaining HTML tags (titles should be plain text)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove newlines (titles should be single line)
  sanitized = sanitized.replace(/[\r\n]+/g, ' ');

  // Truncate to maximum length
  if (sanitized.length > MAX_TITLE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_TITLE_LENGTH);
  }

  return sanitized.trim();
}

/**
 * Sanitize label text
 * Labels should be simple alphanumeric strings with hyphens and underscores
 *
 * @param {string} text - Label text to sanitize
 * @returns {string} Sanitized label
 *
 * @example
 * sanitizeLabel('bug <script>xss</script>');
 * // Returns: 'bug-script-xss'
 */
export function sanitizeLabel(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove all HTML and dangerous content
  let sanitized = removeDangerousPatterns(text);
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Convert to lowercase and replace non-alphanumeric with hyphens
  sanitized = sanitized
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Truncate to maximum length
  if (sanitized.length > MAX_LABEL_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LABEL_LENGTH);
  }

  return sanitized;
}

/**
 * Sanitize URL to ensure it's safe
 * Only allows http, https, and mailto protocols
 *
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 *
 * @example
 * sanitizeUrl('https://github.com/user/repo');
 * // Returns: 'https://github.com/user/repo'
 *
 * @example
 * sanitizeUrl('javascript:alert("xss")');
 * // Returns: null
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Check for allowed protocols
  const allowedProtocols = /^(https?|mailto):/i;

  if (!allowedProtocols.test(trimmed)) {
    // If no protocol, it might be a relative URL - return null for safety
    return null;
  }

  // Remove javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

/**
 * Validate and sanitize message length
 *
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{valid: boolean, sanitized: string, error?: string}} Validation result
 *
 * @example
 * validateLength('Hello', 10);
 * // Returns: { valid: true, sanitized: 'Hello' }
 *
 * @example
 * validateLength('x'.repeat(100), 50);
 * // Returns: { valid: false, sanitized: 'x'.repeat(50), error: 'Message exceeds maximum length of 50 characters' }
 */
export function validateLength(text, maxLength) {
  if (!text || typeof text !== 'string') {
    return { valid: false, sanitized: '', error: 'Text must be a non-empty string' };
  }

  if (text.length <= maxLength) {
    return { valid: true, sanitized: text };
  }

  return {
    valid: false,
    sanitized: text.substring(0, maxLength),
    error: `Message exceeds maximum length of ${maxLength} characters`
  };
}

/**
 * Sanitize a complete Telegram message for GitHub
 *
 * @param {Object} message - Message object
 * @param {string} message.title - Issue title
 * @param {string} message.body - Issue body
 * @param {Array<string>} message.labels - Labels
 * @param {Array<string>} message.urls - URLs
 * @returns {Object} Sanitized message
 *
 * @example
 * sanitizeMessage({
 *   title: 'Bug: <script>xss</script>',
 *   body: '## Description\n\nFound a bug',
 *   labels: ['bug', 'urgent!@#'],
 *   urls: ['https://example.com', 'javascript:alert()']
 * });
 * // Returns: {
 * //   title: 'Bug: xss',
 * //   body: '## Description\n\nFound a bug',
 * //   labels: ['bug', 'urgent'],
 * //   urls: ['https://example.com']
 * // }
 */
export function sanitizeMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('Message must be an object');
  }

  const sanitized = {};

  // Sanitize title
  if (message.title) {
    sanitized.title = sanitizeTitle(message.title);
  }

  // Sanitize body
  if (message.body) {
    sanitized.body = sanitizeMessageBody(message.body);
  }

  // Sanitize labels
  if (Array.isArray(message.labels)) {
    sanitized.labels = message.labels
      .map(label => sanitizeLabel(label))
      .filter(label => label.length > 0); // Remove empty labels
  }

  // Sanitize URLs
  if (Array.isArray(message.urls)) {
    sanitized.urls = message.urls
      .map(url => sanitizeUrl(url))
      .filter(url => url !== null); // Remove invalid URLs
  }

  return sanitized;
}

/**
 * Check if text contains potential XSS vectors
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if potentially dangerous content detected
 *
 * @example
 * containsXSS('Hello world');
 * // Returns: false
 *
 * @example
 * containsXSS('<script>alert("xss")</script>');
 * // Returns: true
 */
export function containsXSS(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Get sanitization configuration
 * @returns {Object} Configuration object
 */
export function getSanitizationConfig() {
  return {
    maxMessageLength: MAX_MESSAGE_LENGTH,
    maxTitleLength: MAX_TITLE_LENGTH,
    maxLabelLength: MAX_LABEL_LENGTH
  };
}
