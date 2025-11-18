/**
 * Global test setup for Vitest
 * This file runs before all tests
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Set default test environment variables if not provided
if (!process.env.TELEGRAM_BOT_TOKEN) {
  process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
}

if (!process.env.TELEGRAM_CHAT_IDS) {
  process.env.TELEGRAM_CHAT_IDS = '123456789,987654321';
}

if (!process.env.GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = 'test_github_token';
}

if (!process.env.GITHUB_REPO_OWNER) {
  process.env.GITHUB_REPO_OWNER = 'test-owner';
}

if (!process.env.GITHUB_REPO_NAME) {
  process.env.GITHUB_REPO_NAME = 'test-repo';
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/telegit_test';
}

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test_openai_key';
}

// Global test lifecycle hooks
beforeAll(async () => {
  // Setup code that runs once before all tests
  console.log('🧪 Test suite starting...');
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
  console.log('✅ Test suite completed');
});

afterEach(() => {
  // Cleanup after each test
  // This is useful for clearing mocks, timers, etc.
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in tests:', error);
});
