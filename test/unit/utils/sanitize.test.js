/**
 * Unit Tests for Input Sanitization Module
 *
 * Tests input sanitization functionality including:
 * - XSS prevention
 * - HTML tag filtering
 * - Message length validation
 * - Markdown preservation
 * - URL sanitization
 * - Label sanitization
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeMessageBody,
  sanitizeTitle,
  sanitizeLabel,
  sanitizeUrl,
  validateLength,
  sanitizeMessage,
  containsXSS,
  getSanitizationConfig
} from '../../../src/utils/sanitize.js';

describe('sanitize', () => {
  describe('sanitizeMessageBody', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("xss")</script> world';
      const result = sanitizeMessageBody(input);
      expect(result).toBe('Hello  world');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'xss\')">Click me</div>';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: URLs', () => {
      const input = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeMessageBody(input);
      expect(result.toLowerCase()).not.toContain('javascript:');
    });

    it('should remove iframe tags', () => {
      const input = '<iframe src="evil.com"></iframe>';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('iframe');
    });

    it('should remove object and embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('object');
      expect(result).not.toContain('embed');
    });

    it('should remove style tags', () => {
      const input = '<style>body { background: url("javascript:alert()"); }</style>';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('style');
    });

    it('should preserve markdown formatting', () => {
      const input = '# Title\n\n**Bold** text and _italic_ text\n\n- List item';
      const result = sanitizeMessageBody(input);
      expect(result).toBe(input);
    });

    it('should preserve code blocks', () => {
      const input = '```javascript\nconst x = 1;\n```';
      const result = sanitizeMessageBody(input);
      expect(result).toBe(input);
    });

    it('should handle unicode characters', () => {
      const input = '你好世界 🔐 こんにちは';
      const result = sanitizeMessageBody(input);
      expect(result).toBe(input);
    });

    it('should truncate to maximum length', () => {
      const input = 'x'.repeat(20000);
      const result = sanitizeMessageBody(input);
      expect(result.length).toBeLessThanOrEqual(10000);
    });

    it('should allow custom maximum length', () => {
      const input = 'x'.repeat(200);
      const result = sanitizeMessageBody(input, { maxLength: 100 });
      expect(result.length).toBe(100);
    });

    it('should return empty string for null input', () => {
      expect(sanitizeMessageBody(null)).toBe('');
      expect(sanitizeMessageBody(undefined)).toBe('');
      expect(sanitizeMessageBody('')).toBe('');
    });

    it('should handle nested tags', () => {
      const input = '<div><script><b>alert("xss")</b></script></div>';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('script');
    });

    it('should handle case-insensitive tags', () => {
      const input = '<SCRIPT>alert("xss")</SCRIPT>';
      const result = sanitizeMessageBody(input);
      expect(result.toLowerCase()).not.toContain('script');
    });

    it('should remove data URLs', () => {
      const input = '<img src="data:text/html,<script>alert(\'xss\')</script>">';
      const result = sanitizeMessageBody(input);
      expect(result.toLowerCase()).not.toContain('data:text/html');
    });
  });

  describe('sanitizeTitle', () => {
    it('should remove script tags from title', () => {
      const input = 'Bug: <script>alert("xss")</script>';
      const result = sanitizeTitle(input);
      expect(result).toBe('Bug:');
      expect(result).not.toContain('script');
    });

    it('should remove all HTML tags', () => {
      const input = 'Title with <b>bold</b> and <i>italic</i>';
      const result = sanitizeTitle(input);
      expect(result).toBe('Title with bold and italic');
    });

    it('should convert newlines to spaces', () => {
      const input = 'Line 1\nLine 2\nLine 3';
      const result = sanitizeTitle(input);
      expect(result).toBe('Line 1 Line 2 Line 3');
      expect(result).not.toContain('\n');
    });

    it('should truncate to maximum length', () => {
      const input = 'x'.repeat(500);
      const result = sanitizeTitle(input);
      expect(result.length).toBeLessThanOrEqual(256);
    });

    it('should return empty string for null input', () => {
      expect(sanitizeTitle(null)).toBe('');
      expect(sanitizeTitle(undefined)).toBe('');
      expect(sanitizeTitle('')).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '   Title with spaces   ';
      const result = sanitizeTitle(input);
      expect(result).toBe('Title with spaces');
    });
  });

  describe('sanitizeLabel', () => {
    it('should convert to lowercase', () => {
      const input = 'BUG';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug');
    });

    it('should replace special characters with hyphens', () => {
      const input = 'bug report!@#';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug-report');
    });

    it('should collapse multiple hyphens', () => {
      const input = 'bug---report';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug-report');
    });

    it('should remove leading and trailing hyphens', () => {
      const input = '-bug-report-';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug-report');
    });

    it('should preserve underscores', () => {
      const input = 'bug_report';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug_report');
    });

    it('should remove script tags', () => {
      const input = 'bug<script>alert("xss")</script>';
      const result = sanitizeLabel(input);
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should truncate to maximum length', () => {
      const input = 'x'.repeat(100);
      const result = sanitizeLabel(input);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('should return empty string for null input', () => {
      expect(sanitizeLabel(null)).toBe('');
      expect(sanitizeLabel(undefined)).toBe('');
      expect(sanitizeLabel('')).toBe('');
    });

    it('should handle unicode characters', () => {
      const input = 'bug-你好';
      const result = sanitizeLabel(input);
      expect(result).toBe('bug');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow https URLs', () => {
      const input = 'https://github.com/user/repo';
      const result = sanitizeUrl(input);
      expect(result).toBe(input);
    });

    it('should allow http URLs', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe(input);
    });

    it('should allow mailto URLs', () => {
      const input = 'mailto:test@example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe(input);
    });

    it('should reject javascript URLs', () => {
      const input = 'javascript:alert("xss")';
      const result = sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should reject data URLs', () => {
      const input = 'data:text/html,<script>alert("xss")</script>';
      const result = sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should reject vbscript URLs', () => {
      const input = 'vbscript:msgbox("xss")';
      const result = sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should reject URLs without protocol', () => {
      const input = 'example.com';
      const result = sanitizeUrl(input);
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      expect(sanitizeUrl(null)).toBeNull();
      expect(sanitizeUrl(undefined)).toBeNull();
      expect(sanitizeUrl('')).toBeNull();
    });

    it('should handle case-insensitive protocols', () => {
      expect(sanitizeUrl('HTTPS://example.com')).toBe('HTTPS://example.com');
      expect(sanitizeUrl('JavaScript:alert()')).toBeNull();
    });

    it('should trim whitespace', () => {
      const input = '  https://example.com  ';
      const result = sanitizeUrl(input);
      expect(result).toBe('https://example.com');
    });
  });

  describe('validateLength', () => {
    it('should accept text within length limit', () => {
      const result = validateLength('Hello', 10);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Hello');
      expect(result.error).toBeUndefined();
    });

    it('should reject text exceeding length limit', () => {
      const result = validateLength('x'.repeat(100), 50);
      expect(result.valid).toBe(false);
      expect(result.sanitized).toBe('x'.repeat(50));
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should handle exact length match', () => {
      const result = validateLength('x'.repeat(10), 10);
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('x'.repeat(10));
    });

    it('should reject null input', () => {
      const result = validateLength(null, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-empty string');
    });

    it('should reject empty input', () => {
      const result = validateLength('', 10);
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeMessage', () => {
    it('should sanitize all message fields', () => {
      const input = {
        title: 'Bug: <script>xss</script> report',
        body: '## Summary\n\nFound a <script>alert("xss")</script> problem',
        labels: ['bug!@#', 'urgent!!!'],
        urls: ['https://example.com', 'javascript:alert()']
      };

      const result = sanitizeMessage(input);

      expect(result.title).not.toContain('<script>');
      expect(result.title).toContain('Bug:');
      expect(result.title).toContain('report');
      expect(result.body).not.toContain('<script>');
      expect(result.body).not.toContain('alert');
      expect(result.body).toContain('## Summary');
      expect(result.labels).toEqual(['bug', 'urgent']);
      expect(result.urls).toEqual(['https://example.com']);
    });

    it('should handle missing fields', () => {
      const input = {
        title: 'Bug report'
      };

      const result = sanitizeMessage(input);

      expect(result.title).toBe('Bug report');
      expect(result.body).toBeUndefined();
      expect(result.labels).toBeUndefined();
      expect(result.urls).toBeUndefined();
    });

    it('should filter out empty labels', () => {
      const input = {
        labels: ['bug', '!!!', 'urgent']
      };

      const result = sanitizeMessage(input);

      expect(result.labels).toEqual(['bug', 'urgent']);
    });

    it('should filter out invalid URLs', () => {
      const input = {
        urls: [
          'https://valid.com',
          'javascript:alert()',
          'data:text/html,evil',
          'http://another-valid.com'
        ]
      };

      const result = sanitizeMessage(input);

      expect(result.urls).toEqual([
        'https://valid.com',
        'http://another-valid.com'
      ]);
    });

    it('should throw error for non-object input', () => {
      expect(() => sanitizeMessage(null)).toThrow('Message must be an object');
      expect(() => sanitizeMessage('string')).toThrow('Message must be an object');
    });

    it('should handle empty message object', () => {
      const result = sanitizeMessage({});
      expect(result).toEqual({});
    });
  });

  describe('containsXSS', () => {
    it('should detect script tags', () => {
      expect(containsXSS('<script>alert("xss")</script>')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsXSS('<div onclick="alert()">')).toBe(true);
    });

    it('should detect javascript: URLs', () => {
      expect(containsXSS('javascript:alert()')).toBe(true);
    });

    it('should detect iframe tags', () => {
      expect(containsXSS('<iframe src="evil"></iframe>')).toBe(true);
    });

    it('should return false for safe text', () => {
      expect(containsXSS('Hello world')).toBe(false);
      expect(containsXSS('# Markdown **bold**')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(containsXSS(null)).toBe(false);
      expect(containsXSS(undefined)).toBe(false);
      expect(containsXSS('')).toBe(false);
    });

    it('should detect data URLs', () => {
      expect(containsXSS('data:text/html,<script>')).toBe(true);
    });

    it('should detect style tags', () => {
      expect(containsXSS('<style>evil css</style>')).toBe(true);
    });
  });

  describe('getSanitizationConfig', () => {
    it('should return configuration object', () => {
      const config = getSanitizationConfig();

      expect(config).toHaveProperty('maxMessageLength');
      expect(config).toHaveProperty('maxTitleLength');
      expect(config).toHaveProperty('maxLabelLength');

      expect(typeof config.maxMessageLength).toBe('number');
      expect(typeof config.maxTitleLength).toBe('number');
      expect(typeof config.maxLabelLength).toBe('number');

      expect(config.maxMessageLength).toBeGreaterThan(0);
      expect(config.maxTitleLength).toBeGreaterThan(0);
      expect(config.maxLabelLength).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(sanitizeMessageBody('')).toBe('');
      expect(sanitizeTitle('')).toBe('');
      expect(sanitizeLabel('')).toBe('');
    });

    it('should handle very long strings', () => {
      const longText = 'x'.repeat(100000);
      const result = sanitizeMessageBody(longText);
      expect(result.length).toBeLessThanOrEqual(10000);
    });

    it('should handle special markdown characters', () => {
      const markdown = '# Title\n\n```code```\n\n> Quote\n\n- List';
      const result = sanitizeMessageBody(markdown);
      expect(result).toBe(markdown);
    });

    it('should handle mixed content', () => {
      const input = 'Normal text <script>evil</script> more text **bold**';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('script');
      expect(result).toContain('**bold**');
    });

    it('should handle URLs in markdown', () => {
      const input = '[Link](https://example.com)';
      const result = sanitizeMessageBody(input);
      expect(result).toBe(input);
    });

    it('should handle malformed HTML', () => {
      const input = '<script>alert<b>test</script>';
      const result = sanitizeMessageBody(input);
      expect(result.toLowerCase()).not.toContain('script');
    });

    it('should handle deeply nested tags', () => {
      const input = '<div><div><div><script>alert()</script></div></div></div>';
      const result = sanitizeMessageBody(input);
      expect(result).not.toContain('script');
    });
  });
});
