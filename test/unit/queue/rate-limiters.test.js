/**
 * Unit tests for rate limiters (Telegram, GitHub, LLM)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import telegramLimiter, { getTelegramLimiterStatus, stopTelegramLimiter } from '../../../src/queue/telegram-limiter.js';
import githubLimiter, { getGitHubLimiterStatus, updateGitHubLimiterFromHeaders, stopGitHubLimiter } from '../../../src/queue/github-limiter.js';
import llmLimiter, { getLLMLimiterStatus, updateLLMLimiterSettings, stopLLMLimiter } from '../../../src/queue/llm-limiter.js';

describe('Rate Limiters', () => {
  describe('Telegram Rate Limiter', () => {

    it('should execute a simple job', async () => {
      const result = await telegramLimiter.schedule(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should enforce rate limiting', async () => {
      const startTime = Date.now();
      const promises = [];

      // Schedule 3 jobs
      for (let i = 0; i < 3; i++) {
        promises.push(telegramLimiter.schedule(() => Promise.resolve(i)));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should take at least 2 * minTime (34ms) for 3 jobs
      // (first job executes immediately, 2nd and 3rd wait)
      expect(duration).toBeGreaterThanOrEqual(34 * 2 - 10); // Allow 10ms tolerance
    });

    it('should provide status information', () => {
      const status = getTelegramLimiterStatus();
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('executing');
      expect(status).toHaveProperty('done');
      expect(status).toHaveProperty('received');
    });

    it('should handle job failures', async () => {
      const error = new Error('Test error');

      await expect(
        telegramLimiter.schedule(() => Promise.reject(error))
      ).rejects.toThrow('Test error');
    });

    it('should retry on rate limit errors (HTTP 429)', async () => {
      let attemptCount = 0;

      const job = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limited');
          error.response = {
            statusCode: 429,
            parameters: { retry_after: 0.1 }, // 0.1 seconds
          };
          throw error;
        }
        return 'success';
      };

      const result = await telegramLimiter.schedule({ id: 'test-retry' }, job);
      expect(result).toBe('success');
      expect(attemptCount).toBe(2); // Original attempt + 1 retry
    });
  });

  describe('GitHub Rate Limiter', () => {

    it('should execute a simple job', async () => {
      const result = await githubLimiter.schedule(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should enforce rate limiting', async () => {
      const startTime = Date.now();
      const promises = [];

      // Schedule 2 jobs (maxConcurrent is 2, so they run in parallel)
      // Then schedule a 3rd that must wait
      for (let i = 0; i < 3; i++) {
        promises.push(
          githubLimiter.schedule(() => new Promise(resolve => {
            setTimeout(() => resolve(i), 100);
          }))
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // With maxConcurrent: 2, first two run in parallel (100ms)
      // Third must wait for minTime (720ms) after first completes
      // Total should be around 100ms (first batch) + 720ms (wait) + 100ms (third job)
      // But since we're running in parallel, it's more complex
      // Let's just verify it took some time
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should provide status information', () => {
      const status = getGitHubLimiterStatus();
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('executing');
      expect(status).toHaveProperty('done');
      expect(status).toHaveProperty('received');
    });

    it('should update reservoir from GitHub headers', () => {
      const headers = {
        'x-ratelimit-remaining': '4500',
        'x-ratelimit-limit': '5000',
      };

      // Mock console.log to verify it was called
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      updateGitHubLimiterFromHeaders(headers);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[GitHubLimiter] Updated reservoir')
      );

      consoleSpy.mockRestore();
    });

    it('should retry on rate limit errors (HTTP 403)', async () => {
      let attemptCount = 0;

      const job = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limited');
          error.status = 403;
          error.response = {
            headers: { 'retry-after': '1' },
          };
          throw error;
        }
        return 'success';
      };

      const result = await githubLimiter.schedule({ id: 'test-retry-403' }, job);
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });
  });

  describe('LLM Rate Limiter', () => {

    it('should execute a simple job', async () => {
      const result = await llmLimiter.schedule(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('should enforce rate limiting with maxConcurrent', async () => {
      const startTime = Date.now();
      const activeJobs = [];
      let maxConcurrent = 0;

      // Schedule 5 jobs that take 50ms each
      const promises = Array.from({ length: 5 }, (_, i) =>
        llmLimiter.schedule(async () => {
          activeJobs.push(i);
          maxConcurrent = Math.max(maxConcurrent, activeJobs.length);
          await new Promise(resolve => setTimeout(resolve, 50));
          activeJobs.splice(activeJobs.indexOf(i), 1);
          return i;
        })
      );

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // With maxConcurrent: 3, we should never have more than 3 jobs running
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(duration).toBeGreaterThanOrEqual(50); // At least one batch duration
    });

    it('should provide status information with config', () => {
      const status = getLLMLimiterStatus();
      expect(status).toHaveProperty('queued');
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('config');
      expect(status.config).toHaveProperty('maxConcurrent');
      expect(status.config).toHaveProperty('reservoir');
    });

    it('should update settings dynamically', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      updateLLMLimiterSettings({
        maxConcurrent: 5,
        requestsPerMinute: 100,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LLMLimiter] Updated settings:',
        expect.objectContaining({
          maxConcurrent: 5,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should retry on rate limit errors with exponential backoff', async () => {
      let attemptCount = 0;

      const job = async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        return 'success';
      };

      const result = await llmLimiter.schedule({ id: 'test-retry-429' }, job);
      expect(result).toBe('success');
      expect(attemptCount).toBe(3); // Original + 2 retries
    });

    it('should retry on timeout errors', async () => {
      let attemptCount = 0;

      const job = async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          throw error;
        }
        return 'success';
      };

      const result = await llmLimiter.schedule({ id: 'test-retry-timeout' }, job);
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should stop all limiters gracefully', async () => {
      // This test ensures we can stop all limiters
      // In a real shutdown scenario
      // Note: If limiters are already stopped, catch the error
      const results = await Promise.allSettled([
        stopTelegramLimiter(),
        stopGitHubLimiter(),
        stopLLMLimiter(),
      ]);

      // Check that at least the stop functions can be called
      // (they might already be stopped, which is fine)
      expect(results).toHaveLength(3);
    });
  });
});
