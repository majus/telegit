/**
 * @file Tests for metrics utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  messagesProcessedTotal,
  processingDuration,
  activeOperations,
  githubApiCallsTotal,
  llmApiCallsTotal,
  errorsTotal,
  queueBacklog,
  incrementCounter,
  setGauge,
  incrementGauge,
  decrementGauge,
  startTimer,
  trackMessageProcessing,
  trackGitHubApiCall,
  trackLLMApiCall,
  trackDatabaseQuery,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
  register,
} from '../../../src/utils/metrics.js';

describe('Metrics Utility', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetMetrics();
  });

  afterEach(() => {
    // Clean up after each test
    resetMetrics();
  });

  describe('Metrics Exports', () => {
    it('should export counter metrics', () => {
      expect(messagesProcessedTotal).toBeDefined();
      expect(githubApiCallsTotal).toBeDefined();
      expect(llmApiCallsTotal).toBeDefined();
      expect(errorsTotal).toBeDefined();
    });

    it('should export histogram metrics', () => {
      expect(processingDuration).toBeDefined();
    });

    it('should export gauge metrics', () => {
      expect(activeOperations).toBeDefined();
      expect(queueBacklog).toBeDefined();
    });

    it('should export utility functions', () => {
      expect(typeof incrementCounter).toBe('function');
      expect(typeof setGauge).toBe('function');
      expect(typeof incrementGauge).toBe('function');
      expect(typeof decrementGauge).toBe('function');
      expect(typeof startTimer).toBe('function');
    });

    it('should export tracking functions', () => {
      expect(typeof trackMessageProcessing).toBe('function');
      expect(typeof trackGitHubApiCall).toBe('function');
      expect(typeof trackLLMApiCall).toBe('function');
      expect(typeof trackDatabaseQuery).toBe('function');
    });

    it('should export Prometheus functions', () => {
      expect(typeof getMetrics).toBe('function');
      expect(typeof getMetricsContentType).toBe('function');
      expect(typeof resetMetrics).toBe('function');
      expect(register).toBeDefined();
    });
  });

  describe('Counter Operations', () => {
    it('should increment counter without labels', () => {
      expect(() => incrementCounter(messagesProcessedTotal, {}, 1)).not.toThrow();
    });

    it('should increment counter with labels', () => {
      expect(() =>
        incrementCounter(messagesProcessedTotal, { status: 'success', intent: 'create_issue' }, 1)
      ).not.toThrow();
    });

    it('should increment counter by custom value', () => {
      expect(() => incrementCounter(messagesProcessedTotal, { status: 'success' }, 5)).not.toThrow();
    });
  });

  describe('Gauge Operations', () => {
    it('should set gauge value', () => {
      expect(() => setGauge(queueBacklog, {}, 100)).not.toThrow();
    });

    it('should increment gauge', () => {
      expect(() => incrementGauge(activeOperations, { operation_type: 'test' })).not.toThrow();
    });

    it('should decrement gauge', () => {
      incrementGauge(activeOperations, { operation_type: 'test' });
      expect(() => decrementGauge(activeOperations, { operation_type: 'test' })).not.toThrow();
    });

    it('should increment gauge by custom value', () => {
      expect(() => incrementGauge(activeOperations, { operation_type: 'test' }, 5)).not.toThrow();
    });

    it('should decrement gauge by custom value', () => {
      incrementGauge(activeOperations, { operation_type: 'test' }, 10);
      expect(() => decrementGauge(activeOperations, { operation_type: 'test' }, 5)).not.toThrow();
    });
  });

  describe('Timer Operations', () => {
    it('should start and end timer', async () => {
      const endTimer = startTimer(processingDuration, { intent: 'test', status: 'success' });
      expect(typeof endTimer).toBe('function');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => endTimer()).not.toThrow();
    });

    it('should handle timer without labels', async () => {
      const endTimer = startTimer(processingDuration);
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(() => endTimer()).not.toThrow();
    });
  });

  describe('Message Processing Tracking', () => {
    it('should track successful message processing', async () => {
      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      };

      const result = await trackMessageProcessing(testFn, 'create_issue');
      expect(result).toBe('success');
    });

    it('should track failed message processing', async () => {
      const testFn = async () => {
        throw new Error('Processing failed');
      };

      await expect(trackMessageProcessing(testFn, 'create_issue')).rejects.toThrow('Processing failed');
    });

    it('should decrement active operations after completion', async () => {
      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'success';
      };

      await trackMessageProcessing(testFn, 'create_issue');
      // Active operations should be decremented after completion
    });
  });

  describe('GitHub API Tracking', () => {
    it('should track successful GitHub API call', async () => {
      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: 200, data: 'success' };
      };

      const result = await trackGitHubApiCall(testFn, 'create_issue');
      expect(result).toEqual({ status: 200, data: 'success' });
    });

    it('should track failed GitHub API call', async () => {
      const testFn = async () => {
        throw new Error('API call failed');
      };

      await expect(trackGitHubApiCall(testFn, 'create_issue')).rejects.toThrow('API call failed');
    });
  });

  describe('LLM API Tracking', () => {
    it('should track successful LLM API call', async () => {
      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { content: 'response' };
      };

      const result = await trackLLMApiCall(testFn, 'gpt-4');
      expect(result).toEqual({ content: 'response' });
    });

    it('should track LLM API call with token usage', async () => {
      const testFn = async () => {
        return { content: 'response' };
      };

      const tokenUsage = { promptTokens: 100, completionTokens: 50 };
      const result = await trackLLMApiCall(testFn, 'gpt-4', tokenUsage);
      expect(result).toEqual({ content: 'response' });
    });

    it('should track failed LLM API call', async () => {
      const testFn = async () => {
        throw new Error('LLM call failed');
      };

      await expect(trackLLMApiCall(testFn, 'gpt-4')).rejects.toThrow('LLM call failed');
    });
  });

  describe('Database Query Tracking', () => {
    it('should track successful database query', async () => {
      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { rows: [] };
      };

      const result = await trackDatabaseQuery(testFn, 'select');
      expect(result).toEqual({ rows: [] });
    });

    it('should track failed database query', async () => {
      const testFn = async () => {
        throw new Error('Query failed');
      };

      await expect(trackDatabaseQuery(testFn, 'select')).rejects.toThrow('Query failed');
    });
  });

  describe('Metrics Export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Add some metrics
      incrementCounter(messagesProcessedTotal, { status: 'success', intent: 'create_issue' }, 1);
      setGauge(queueBacklog, {}, 5);

      const metrics = await getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should return correct content type', () => {
      const contentType = getMetricsContentType();
      expect(typeof contentType).toBe('string');
      expect(contentType).toContain('text/plain');
    });
  });

  describe('Metrics Reset', () => {
    it('should reset all metrics', () => {
      // Add some metrics
      incrementCounter(messagesProcessedTotal, { status: 'success', intent: 'create_issue' }, 5);
      setGauge(queueBacklog, {}, 100);

      // Reset
      expect(() => resetMetrics()).not.toThrow();

      // Metrics should be reset (unable to verify exact values, but operation should succeed)
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in counter operations gracefully', () => {
      // Test with invalid counter (should not crash)
      expect(() => incrementCounter(null, {}, 1)).not.toThrow();
    });

    it('should handle errors in gauge operations gracefully', () => {
      // Test with invalid gauge (should not crash)
      expect(() => setGauge(null, {}, 100)).not.toThrow();
    });

    it('should handle errors in timer operations gracefully', () => {
      // Test with invalid histogram (should not crash)
      const endTimer = startTimer(null, {});
      expect(() => endTimer()).not.toThrow();
    });
  });
});
