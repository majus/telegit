/**
 * @file Logger utility using Pino for structured JSON logging
 * @module utils/logger
 */

import pino from 'pino';

// Define log levels
const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

// Sensitive fields that should be redacted from logs
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'BOT_TOKEN',
  'GITHUB_TOKEN',
  'ENCRYPTION_KEY',
  'OPENAI_API_KEY',
  'LLM_API_KEY',
  'DATABASE_URL',
  'pat',
  'personalAccessToken',
];

/**
 * Redact sensitive information from log objects
 * @param {string} path - The path to the current field
 * @param {*} value - The value to check
 * @returns {*} Redacted value if sensitive, original value otherwise
 */
function redactSensitiveData(path, value) {
  // Check if the path contains any sensitive field names
  const pathLower = path.toLowerCase();
  const isSensitive = SENSITIVE_FIELDS.some((field) =>
    pathLower.includes(field.toLowerCase())
  );

  if (isSensitive) {
    return '[REDACTED]';
  }

  return value;
}

/**
 * Create a custom serializer for redacting sensitive data
 * @returns {Function} Serializer function
 */
function createRedactionSerializer() {
  return (obj) => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const redacted = {};
    for (const [key, value] of Object.entries(obj)) {
      const redactedValue = redactSensitiveData(key, value);
      if (redactedValue !== '[REDACTED]' && typeof value === 'object' && value !== null) {
        redacted[key] = createRedactionSerializer()(value);
      } else {
        redacted[key] = redactedValue;
      }
    }
    return redacted;
  };
}

// Determine log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Create Pino logger instance with configuration
const logger = pino({
  level: logLevel,

  // Structured JSON output format
  formatters: {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
      };
    },
  },

  // Redact sensitive information
  redact: {
    paths: SENSITIVE_FIELDS,
    censor: '[REDACTED]',
  },

  // Base properties included in every log
  base: {
    service: 'telegit',
    env: process.env.NODE_ENV || 'development',
  },

  // Timestamp format
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with additional context
 * @param {Object} context - Additional context to include in logs
 * @returns {Object} Child logger instance
 */
export function createChildLogger(context) {
  return logger.child(context);
}

/**
 * Log a debug message
 * @param {Object|string} messageOrObject - Message or object to log
 * @param {string} [message] - Optional message if first param is object
 */
export function debug(messageOrObject, message) {
  if (typeof messageOrObject === 'string') {
    logger.debug(messageOrObject);
  } else {
    logger.debug(messageOrObject, message);
  }
}

/**
 * Log an info message
 * @param {Object|string} messageOrObject - Message or object to log
 * @param {string} [message] - Optional message if first param is object
 */
export function info(messageOrObject, message) {
  if (typeof messageOrObject === 'string') {
    logger.info(messageOrObject);
  } else {
    logger.info(messageOrObject, message);
  }
}

/**
 * Log a warning message
 * @param {Object|string} messageOrObject - Message or object to log
 * @param {string} [message] - Optional message if first param is object
 */
export function warn(messageOrObject, message) {
  if (typeof messageOrObject === 'string') {
    logger.warn(messageOrObject);
  } else {
    logger.warn(messageOrObject, message);
  }
}

/**
 * Log an error message
 * @param {Object|string} messageOrObject - Message or object to log
 * @param {string} [message] - Optional message if first param is object
 */
export function error(messageOrObject, message) {
  if (typeof messageOrObject === 'string') {
    logger.error(messageOrObject);
  } else {
    logger.error(messageOrObject, message);
  }
}

/**
 * Log a fatal message
 * @param {Object|string} messageOrObject - Message or object to log
 * @param {string} [message] - Optional message if first param is object
 */
export function fatal(messageOrObject, message) {
  if (typeof messageOrObject === 'string') {
    logger.fatal(messageOrObject);
  } else {
    logger.fatal(messageOrObject, message);
  }
}

// Export the main logger instance and helper functions
export default logger;
export { LOG_LEVELS };
