/**
 * Message Processing Queue
 *
 * Implements a priority-based message processing queue with retry logic
 * and comprehensive error handling.
 *
 * Features:
 * - Priority-based processing (high priority messages processed first)
 * - Exponential backoff retry logic
 * - Configurable retry attempts
 * - Queue metrics for monitoring
 * - Graceful shutdown support
 */

import Bottleneck from 'bottleneck';
import logger from '../utils/logger.js';

/**
 * Message priority levels
 */
export const Priority = {
  URGENT: 1,    // Critical messages (e.g., errors, admin commands)
  HIGH: 3,      // Important messages (e.g., direct mentions)
  NORMAL: 5,    // Standard messages (default)
  LOW: 7,       // Background tasks
};

/**
 * Queue configuration
 */
const DEFAULT_CONFIG = {
  maxConcurrent: parseInt(process.env.MESSAGE_QUEUE_MAX_CONCURRENT || '5', 10),
  minTime: parseInt(process.env.MESSAGE_QUEUE_MIN_TIME || '100', 10), // ms between jobs
  maxRetries: parseInt(process.env.MESSAGE_QUEUE_MAX_RETRIES || '3', 10),
  baseRetryDelay: parseInt(process.env.MESSAGE_QUEUE_BASE_RETRY_DELAY || '1000', 10), // 1 second
};

/**
 * Message Processing Queue
 */
class MessageQueue {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create Bottleneck limiter with priority support
    this.limiter = new Bottleneck({
      maxConcurrent: this.config.maxConcurrent,
      minTime: this.config.minTime,
    });

    // Metrics tracking
    this.metrics = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
    };

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for monitoring and metrics
   */
  setupEventHandlers() {
    this.limiter.on('error', (error) => {
      logger.error({ err: error }, '[MessageQueue] Limiter error');
    });

    this.limiter.on('failed', async (error, jobInfo) => {
      this.metrics.retried++;

      logger.warn({
        error: error.message,
        retryCount: jobInfo.retryCount,
        maxRetries: this.config.maxRetries,
      }, '[MessageQueue] Job failed');

      // Check if we should retry
      if (jobInfo.retryCount < this.config.maxRetries) {
        // Calculate exponential backoff delay
        const delay = this.config.baseRetryDelay * Math.pow(2, jobInfo.retryCount);
        const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
        const actualDelay = delay + jitter;

        logger.info({
          retryDelaySeconds: Math.ceil(actualDelay / 1000),
          attempt: jobInfo.retryCount + 1,
          maxRetries: this.config.maxRetries,
        }, '[MessageQueue] Retrying job');
        return actualDelay;
      }

      // Max retries reached
      logger.error({ err: error }, '[MessageQueue] Max retries reached, giving up');
      this.metrics.failed++;
      return null; // Don't retry
    });

    this.limiter.on('retry', (error, jobInfo) => {
      logger.info({
        error: error.message,
        attempt: jobInfo.retryCount + 1,
        maxRetries: this.config.maxRetries,
      }, '[MessageQueue] Retrying job');
    });

    this.limiter.on('done', (info) => {
      this.metrics.processed++;
      this.metrics.succeeded++;
    });
  }

  /**
   * Add a message to the queue for processing
   *
   * @param {Function} processor - Async function to process the message
   * @param {Object} options - Processing options
   * @param {number} [options.priority=Priority.NORMAL] - Message priority
   * @param {string} [options.id] - Unique message ID for tracking
   * @param {Object} [options.context] - Additional context for logging
   * @returns {Promise<any>} Result of the processor function
   *
   * @example
   * await queue.add(
   *   async () => processMessage(message),
   *   { priority: Priority.HIGH, id: message.message_id }
   * );
   */
  async add(processor, options = {}) {
    const {
      priority = Priority.NORMAL,
      id = Date.now().toString(),
      context = {},
    } = options;

    const startTime = Date.now();

    try {
      logger.debug({
        id,
        priority,
        queueSize: this.getQueueSize(),
        context,
      }, '[MessageQueue] Adding job to queue');

      // Schedule the job with priority
      const result = await this.limiter.schedule(
        { priority, id },
        async () => {
          logger.debug({ id, context }, '[MessageQueue] Processing job');
          return await processor();
        }
      );

      const processingTime = Date.now() - startTime;
      this.updateProcessingTimeMetrics(processingTime);

      logger.info({
        id,
        processingTime,
        context,
      }, '[MessageQueue] Job completed');

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateProcessingTimeMetrics(processingTime);

      logger.error({
        id,
        err: error,
        processingTime,
        context,
      }, '[MessageQueue] Job failed permanently');

      throw error;
    }
  }

  /**
   * Update processing time metrics
   */
  updateProcessingTimeMetrics(processingTime) {
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime =
      this.metrics.totalProcessingTime / Math.max(this.metrics.processed, 1);
  }

  /**
   * Get current queue size
   *
   * @returns {number} Number of jobs waiting in queue
   */
  getQueueSize() {
    return this.limiter.counts().QUEUED || 0;
  }

  /**
   * Get current queue status and metrics
   *
   * @returns {Object} Queue status and metrics
   */
  getStatus() {
    const counts = this.limiter.counts();

    return {
      queue: {
        queued: counts.QUEUED || 0,
        running: counts.RUNNING || 0,
        executing: counts.EXECUTING || 0,
      },
      metrics: {
        ...this.metrics,
        averageProcessingTime: Math.round(this.metrics.averageProcessingTime),
      },
      config: {
        maxConcurrent: this.config.maxConcurrent,
        minTime: this.config.minTime,
        maxRetries: this.config.maxRetries,
      },
    };
  }

  /**
   * Get metrics for Prometheus or other monitoring systems
   *
   * @returns {Object} Metrics in a format suitable for monitoring
   */
  getMetrics() {
    return {
      telegit_message_queue_size: this.getQueueSize(),
      telegit_message_queue_running: this.limiter.counts().RUNNING || 0,
      telegit_messages_processed_total: this.metrics.processed,
      telegit_messages_succeeded_total: this.metrics.succeeded,
      telegit_messages_failed_total: this.metrics.failed,
      telegit_messages_retried_total: this.metrics.retried,
      telegit_message_processing_time_avg_ms: Math.round(this.metrics.averageProcessingTime),
    };
  }

  /**
   * Check if the queue is empty
   *
   * @returns {boolean} True if queue is empty
   */
  isEmpty() {
    return this.getQueueSize() === 0;
  }

  /**
   * Wait for the queue to become empty
   * Useful for graceful shutdown
   *
   * @param {number} [timeout=30000] - Maximum time to wait in ms
   * @returns {Promise<boolean>} True if queue became empty, false if timeout
   */
  async waitForEmpty(timeout = 30000) {
    const startTime = Date.now();

    while (!this.isEmpty()) {
      if (Date.now() - startTime > timeout) {
        logger.warn({ timeout }, '[MessageQueue] Timeout waiting for queue to empty');
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return true;
  }

  /**
   * Stop the queue and reject all pending jobs
   *
   * @param {Object} options - Stop options
   * @param {boolean} [options.dropWaitingJobs=false] - Drop pending jobs
   * @param {number} [options.timeout=30000] - Timeout for graceful shutdown
   */
  async stop(options = {}) {
    const {
      dropWaitingJobs = false,
      timeout = 30000,
    } = options;

    logger.info({
      queueSize: this.getQueueSize(),
      dropWaitingJobs,
    }, '[MessageQueue] Stopping queue');

    if (!dropWaitingJobs) {
      // Wait for queue to empty
      const emptied = await this.waitForEmpty(timeout);

      if (!emptied) {
        logger.warn({ queueSize: this.getQueueSize() }, '[MessageQueue] Force stopping with pending jobs');
      }
    }

    await this.limiter.stop({ dropWaitingJobs });
    logger.info('[MessageQueue] Stopped');
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.metrics = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      retried: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
    };
  }
}

// Export singleton instance
export const messageQueue = new MessageQueue();

// Also export the class for testing
export default MessageQueue;
