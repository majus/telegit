/**
 * @file Tests for logger utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import logger, { debug, info, warn, error, fatal, createChildLogger, LOG_LEVELS } from '../../../src/utils/logger.js';

describe('Logger Utility', () => {
  beforeEach(() => {
    // Reset any logger state if needed
    vi.clearAllMocks();
  });

  describe('Logger Instance', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should export LOG_LEVELS constant', () => {
      expect(LOG_LEVELS).toBeDefined();
      expect(LOG_LEVELS.debug).toBe(20);
      expect(LOG_LEVELS.info).toBe(30);
      expect(LOG_LEVELS.warn).toBe(40);
      expect(LOG_LEVELS.error).toBe(50);
      expect(LOG_LEVELS.fatal).toBe(60);
    });
  });

  describe('Logging Functions', () => {
    it('should log info messages with string', () => {
      expect(() => info('Test info message')).not.toThrow();
    });

    it('should log info messages with object and message', () => {
      expect(() => info({ key: 'value' }, 'Test info message')).not.toThrow();
    });

    it('should log debug messages', () => {
      expect(() => debug('Test debug message')).not.toThrow();
    });

    it('should log warning messages', () => {
      expect(() => warn('Test warning message')).not.toThrow();
    });

    it('should log error messages', () => {
      expect(() => error('Test error message')).not.toThrow();
    });

    it('should log fatal messages', () => {
      expect(() => fatal('Test fatal message')).not.toThrow();
    });
  });

  describe('Child Logger', () => {
    it('should create a child logger with context', () => {
      const childLogger = createChildLogger({ service: 'test-service' });
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });

    it('should allow logging with child logger', () => {
      const childLogger = createChildLogger({ service: 'test-service' });
      expect(() => childLogger.info('Test message')).not.toThrow();
    });
  });

  describe('Sensitive Data Redaction', () => {
    it('should not throw when logging objects with sensitive field names', () => {
      // The logger should handle these gracefully and redact them
      expect(() =>
        info({
          password: 'secret123',
          token: 'abc123',
          apiKey: 'key123',
        })
      ).not.toThrow();
    });

    it('should handle nested objects with sensitive data', () => {
      expect(() =>
        info({
          user: {
            name: 'test',
            password: 'secret',
          },
          config: {
            apiKey: 'key123',
          },
        })
      ).not.toThrow();
    });
  });

  describe('Error Logging', () => {
    it('should log error objects', () => {
      const testError = new Error('Test error');
      expect(() => error({ err: testError }, 'Error occurred')).not.toThrow();
    });

    it('should log error with additional context', () => {
      const testError = new Error('Test error');
      expect(() =>
        error(
          {
            err: testError,
            context: { operation: 'test', userId: 123 },
          },
          'Error with context'
        )
      ).not.toThrow();
    });
  });

  describe('Structured Logging', () => {
    it('should log with structured data', () => {
      expect(() =>
        info(
          {
            messageId: '123',
            chatId: 456,
            intent: 'create_issue',
          },
          'Processing message'
        )
      ).not.toThrow();
    });

    it('should handle various data types', () => {
      expect(() =>
        info({
          string: 'value',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          object: { nested: 'value' },
          null: null,
          undefined: undefined,
        })
      ).not.toThrow();
    });
  });
});
