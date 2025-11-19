/**
 * Unit tests for Message Processing Queue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import MessageQueue, { Priority, messageQueue } from '../../../src/queue/message-queue.js';

describe('Message Processing Queue', () => {
  let queue;
  let idCounter = 0;

  // Helper to generate unique IDs
  const generateId = () => `test-${Date.now()}-${idCounter++}`;

  beforeEach(async () => {
    // Create a fresh queue for each test with faster settings
    queue = new MessageQueue({
      maxConcurrent: 2,
      minTime: 10,
      maxRetries: 3,
      baseRetryDelay: 100,
    });
    idCounter = 0;
  });

  afterEach(async () => {
    // Stop the queue after each test
    await queue.stop({ dropWaitingJobs: true });
  });

  describe('Basic Functionality', () => {
    it('should process a simple message', async () => {
      const result = await queue.add(async () => {
        return 'processed';
      });

      expect(result).toBe('processed');
    });

    it('should process multiple messages', async () => {
      const results = await Promise.all([
        queue.add(async () => 'message1', { id: generateId() }),
        queue.add(async () => 'message2', { id: generateId() }),
        queue.add(async () => 'message3', { id: generateId() }),
      ]);

      expect(results).toEqual(['message1', 'message2', 'message3']);
    });

    it('should handle async processing', async () => {
      const result = await queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-result';
      });

      expect(result).toBe('async-result');
    });
  });

  describe('Priority Processing', () => {
    it('should process high priority messages first', async () => {
      const processed = [];

      // Add messages in reverse priority order
      // They should be processed in priority order
      const promises = [
        queue.add(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            processed.push('low');
            return 'low';
          },
          { priority: Priority.LOW, id: 'low' }
        ),
        queue.add(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            processed.push('high');
            return 'high';
          },
          { priority: Priority.HIGH, id: 'high' }
        ),
        queue.add(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            processed.push('urgent');
            return 'urgent';
          },
          { priority: Priority.URGENT, id: 'urgent' }
        ),
        queue.add(
          async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            processed.push('normal');
            return 'normal';
          },
          { priority: Priority.NORMAL, id: 'normal' }
        ),
      ];

      await Promise.all(promises);

      // Due to maxConcurrent: 2, first two start immediately
      // But among queued ones, priority should be respected
      // First batch might be 'low' and 'high' (whichever was scheduled first)
      // But 'urgent' should definitely be processed before 'normal'
      const urgentIndex = processed.indexOf('urgent');
      const normalIndex = processed.indexOf('normal');

      expect(urgentIndex).toBeLessThan(normalIndex);
    });

    it('should support all priority levels', async () => {
      const results = await Promise.all([
        queue.add(async () => 'urgent', { priority: Priority.URGENT, id: generateId() }),
        queue.add(async () => 'high', { priority: Priority.HIGH, id: generateId() }),
        queue.add(async () => 'normal', { priority: Priority.NORMAL, id: generateId() }),
        queue.add(async () => 'low', { priority: Priority.LOW, id: generateId() }),
      ]);

      expect(results).toHaveLength(4);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      let attemptCount = 0;

      const result = await queue.add(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return 'success-after-retries';
      });

      expect(result).toBe('success-after-retries');
      expect(attemptCount).toBe(3);
    });

    it('should give up after max retries', async () => {
      let attemptCount = 0;

      await expect(
        queue.add(async () => {
          attemptCount++;
          throw new Error(`Attempt ${attemptCount} failed`);
        })
      ).rejects.toThrow('Attempt');

      // Should attempt initial + 3 retries = 4 total
      expect(attemptCount).toBe(4);
    });

    it('should not retry if job succeeds on first attempt', async () => {
      let attemptCount = 0;

      const result = await queue.add(async () => {
        attemptCount++;
        return 'immediate-success';
      });

      expect(result).toBe('immediate-success');
      expect(attemptCount).toBe(1);
    });
  });

  describe('Queue Status and Metrics', () => {
    it('should track queue size', async () => {
      // Add some slow jobs
      const promises = Array.from({ length: 5 }, (_, i) =>
        queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return i;
        }, { id: generateId() })
      );

      // Queue size should be > 0 while processing
      // (maxConcurrent is 2, so at least 3 should be queued)
      await new Promise(resolve => setTimeout(resolve, 10));
      const queueSize = queue.getQueueSize();
      expect(queueSize).toBeGreaterThan(0);

      await Promise.all(promises);

      // Queue should be empty after all complete
      expect(queue.getQueueSize()).toBe(0);
    });

    it('should provide comprehensive status', async () => {
      const status = queue.getStatus();

      expect(status).toHaveProperty('queue');
      expect(status.queue).toHaveProperty('queued');
      expect(status.queue).toHaveProperty('running');
      expect(status.queue).toHaveProperty('executing');

      expect(status).toHaveProperty('metrics');
      expect(status.metrics).toHaveProperty('processed');
      expect(status.metrics).toHaveProperty('succeeded');
      expect(status.metrics).toHaveProperty('failed');
      expect(status.metrics).toHaveProperty('retried');
      expect(status.metrics).toHaveProperty('averageProcessingTime');

      expect(status).toHaveProperty('config');
      expect(status.config).toHaveProperty('maxConcurrent');
      expect(status.config).toHaveProperty('maxRetries');
    });

    it('should track processing metrics', async () => {
      await queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });

      const status = queue.getStatus();
      expect(status.metrics.processed).toBe(1);
      expect(status.metrics.succeeded).toBe(1);
      expect(status.metrics.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track failures in metrics', async () => {
      try {
        await queue.add(async () => {
          throw new Error('Permanent failure');
        });
      } catch (error) {
        // Expected to fail
      }

      const status = queue.getStatus();
      expect(status.metrics.processed).toBe(1);
      expect(status.metrics.failed).toBe(1);
    });

    it('should provide Prometheus-compatible metrics', () => {
      const metrics = queue.getMetrics();

      expect(metrics).toHaveProperty('telegit_message_queue_size');
      expect(metrics).toHaveProperty('telegit_message_queue_running');
      expect(metrics).toHaveProperty('telegit_messages_processed_total');
      expect(metrics).toHaveProperty('telegit_messages_succeeded_total');
      expect(metrics).toHaveProperty('telegit_messages_failed_total');
      expect(metrics).toHaveProperty('telegit_messages_retried_total');
      expect(metrics).toHaveProperty('telegit_message_processing_time_avg_ms');
    });
  });

  describe('Error Handling', () => {
    it('should handle synchronous errors', async () => {
      await expect(
        queue.add(() => {
          throw new Error('Sync error');
        })
      ).rejects.toThrow('Sync error');
    });

    it('should handle async errors', async () => {
      await expect(
        queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');
    });

    it('should continue processing other jobs after errors', async () => {
      const results = await Promise.allSettled([
        queue.add(async () => {
          throw new Error('Job 1 failed');
        }, { id: generateId() }),
        queue.add(async () => 'Job 2 success', { id: generateId() }),
        queue.add(async () => {
          throw new Error('Job 3 failed');
        }, { id: generateId() }),
        queue.add(async () => 'Job 4 success', { id: generateId() }),
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');
      expect(results[1].value).toBe('Job 2 success');
      expect(results[2].status).toBe('rejected');
      expect(results[3].status).toBe('fulfilled');
      expect(results[3].value).toBe('Job 4 success');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should detect empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('should wait for queue to empty', async () => {
      // Add jobs that take some time
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return `done-${i}`;
        }, { id: generateId() }));
      }

      // Give it a moment to queue up (with maxConcurrent: 2, third will be queued)
      await new Promise(resolve => setTimeout(resolve, 10));

      // Wait for empty
      const emptied = await queue.waitForEmpty(2000);
      expect(emptied).toBe(true);
      expect(queue.isEmpty()).toBe(true);

      await Promise.all(promises);
    });

    it('should timeout when waiting for empty queue', async () => {
      // Add multiple slow jobs to ensure queue stays busy
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(queue.add(async () => {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return `slow-${i}`;
        }, { id: generateId() }));
      }

      // Give jobs time to start processing
      await new Promise(resolve => setTimeout(resolve, 20));

      // Wait with very short timeout (jobs take 2s each, timeout after 50ms)
      const emptied = await queue.waitForEmpty(50);
      expect(emptied).toBe(false);

      // Verify queue is still not empty
      expect(queue.isEmpty()).toBe(false);

      // Clean up - afterEach will handle stopping with dropWaitingJobs
    }, 10000);

    it('should stop gracefully without dropping jobs', async () => {
      const processed = [];

      // Add some jobs
      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        processed.push(1);
        return 1;
      }, { id: generateId() });

      queue.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        processed.push(2);
        return 2;
      }, { id: generateId() });

      // Stop without dropping (manually, so we skip afterEach)
      await queue.stop({ dropWaitingJobs: false, timeout: 1000 });

      // All jobs should have been processed
      expect(processed).toHaveLength(2);

      // Create a new queue for afterEach to stop
      queue = new MessageQueue({ maxConcurrent: 2, minTime: 10, maxRetries: 3, baseRetryDelay: 100 });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(messageQueue).toBeInstanceOf(MessageQueue);
    });

    it('should be able to use singleton instance', async () => {
      const result = await messageQueue.add(async () => 'singleton-test');
      expect(result).toBe('singleton-test');
    });
  });

  describe('Context and ID Tracking', () => {
    it('should accept and log context information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await queue.add(
        async () => 'test',
        {
          id: 'test-123',
          context: { userId: 'user-1', chatId: 'chat-1' },
        }
      );

      // Verify console.log was called with context
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MessageQueue]'),
        expect.objectContaining({
          id: 'test-123',
          context: expect.objectContaining({
            userId: 'user-1',
            chatId: 'chat-1',
          }),
        })
      );

      consoleSpy.mockRestore();
    });
  });
});
