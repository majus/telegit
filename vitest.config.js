/**
 * Vitest configuration
 * https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    setupFiles: ['./test/setup.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.d.ts',
        'src/types/**',
        'test/**',
        'config/**',
        'node_modules/**',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },

    // Test matching patterns
    include: ['test/**/*.test.js', 'test/**/*.spec.js'],
    exclude: ['node_modules/**', 'dist/**'],

    // Test execution
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporters
    reporters: ['verbose'],

    // Mock configuration
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
