/**
 * Unit tests for configuration loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, validateEnv } from '../../config/env.js';

describe('Configuration Loader', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should load valid configuration', () => {
    const config = loadConfig();

    expect(config).toBeDefined();
    expect(config.telegram).toBeDefined();
    expect(config.github).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.llm).toBeDefined();
    expect(config.app).toBeDefined();
  });

  it('should parse Telegram chat IDs correctly', () => {
    const config = loadConfig();

    expect(config.telegram.allowedChatIds).toBeInstanceOf(Array);
    expect(config.telegram.allowedChatIds.length).toBeGreaterThan(0);
    expect(typeof config.telegram.allowedChatIds[0]).toBe('number');
  });

  it('should parse Telegram user IDs when provided', () => {
    process.env.TELEGRAM_USER_IDS = '123456,789012,345678';
    const config = loadConfig();

    expect(config.telegram.allowedUserIds).toBeInstanceOf(Array);
    expect(config.telegram.allowedUserIds).toEqual([123456, 789012, 345678]);
  });

  it('should allow all users when TELEGRAM_USER_IDS is empty (backward compatibility)', () => {
    process.env.TELEGRAM_USER_IDS = '';
    const config = loadConfig();

    expect(config.telegram.allowedUserIds).toBeInstanceOf(Array);
    expect(config.telegram.allowedUserIds).toEqual([]);
  });

  it('should allow all users when TELEGRAM_USER_IDS is not set (backward compatibility)', () => {
    delete process.env.TELEGRAM_USER_IDS;
    const config = loadConfig();

    expect(config.telegram.allowedUserIds).toBeInstanceOf(Array);
    expect(config.telegram.allowedUserIds).toEqual([]);
  });

  it('should skip invalid user IDs in TELEGRAM_USER_IDS', () => {
    process.env.TELEGRAM_USER_IDS = '123456,invalid,789012,,  ,345678';
    const config = loadConfig();

    expect(config.telegram.allowedUserIds).toEqual([123456, 789012, 345678]);
  });

  it('should trim whitespace from user IDs', () => {
    process.env.TELEGRAM_USER_IDS = ' 123456 , 789012 , 345678 ';
    const config = loadConfig();

    expect(config.telegram.allowedUserIds).toEqual([123456, 789012, 345678]);
  });

  it('should validate environment successfully', () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it('should throw error for missing required variables', () => {
    // Remove a required variable
    delete process.env.TELEGRAM_BOT_TOKEN;

    expect(() => loadConfig()).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('should apply default values for optional variables', () => {
    const config = loadConfig();

    expect(config.app.nodeEnv).toBe('test');
    expect(config.app.logLevel).toBeDefined();
    expect(config.llm.model).toBeDefined();
  });

  it('should parse numeric configuration values', () => {
    const config = loadConfig();

    expect(typeof config.llm.temperature).toBe('number');
    expect(typeof config.app.rateLimit.maxConcurrent).toBe('number');
    expect(typeof config.app.rateLimit.minTime).toBe('number');
  });
});
