/**
 * Telegram API Rate Limiter
 *
 * Implements rate limiting for Telegram Bot API to prevent HTTP 429 errors.
 *
 * Telegram Bot API limits:
 * - ~30 messages per second per bot
 * - 1 request per chat per second for group messages
 *
 * @see https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this
 */

import Bottleneck from 'bottleneck';

/**
 * Telegram API rate limiter configuration
 *
 * Configuration:
 * - maxConcurrent: 1 - Process one request at a time to avoid burst issues
 * - minTime: 34ms - Minimum time between requests (~30 msgs/sec)
 * - reservoir: 30 - Initial number of requests available
 * - reservoirRefreshAmount: 30 - Number of requests to add on refresh
 * - reservoirRefreshInterval: 1000ms - Refresh every second
 */
const telegramLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 34, // ~30 msgs/sec (1000ms / 30 ≈ 33.33ms)
  reservoir: 30,
  reservoirRefreshAmount: 30,
  reservoirRefreshInterval: 1000, // 1 second
});

/**
 * Event handlers for monitoring and debugging
 */
telegramLimiter.on('error', (error) => {
  console.error('[TelegramLimiter] Error:', error);
});

telegramLimiter.on('failed', async (error, jobInfo) => {
  console.warn('[TelegramLimiter] Job failed:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });

  // Retry on rate limit errors (HTTP 429)
  if (error.response?.statusCode === 429) {
    const retryAfter = error.response.parameters?.retry_after || 1;
    console.log(`[TelegramLimiter] Rate limited, retrying after ${retryAfter}s`);
    return retryAfter * 1000; // Return delay in ms
  }

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    console.log('[TelegramLimiter] Network error, retrying in 1s');
    return 1000;
  }

  return null; // Don't retry for other errors
});

telegramLimiter.on('retry', (error, jobInfo) => {
  console.log('[TelegramLimiter] Retrying job:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });
});

/**
 * Wrap a Telegram API call with rate limiting
 *
 * @param {Function} fn - Async function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} Result of the function
 *
 * @example
 * await telegramLimiter.schedule(() => bot.telegram.sendMessage(chatId, text));
 */

/**
 * Get current limiter status for monitoring
 *
 * @returns {Object} Current status including counts and availability
 */
export function getTelegramLimiterStatus() {
  return {
    queued: telegramLimiter.counts().QUEUED,
    running: telegramLimiter.counts().RUNNING,
    executing: telegramLimiter.counts().EXECUTING,
    done: telegramLimiter.counts().DONE,
    received: telegramLimiter.counts().RECEIVED,
  };
}

/**
 * Stop the limiter and reject all pending jobs
 * Useful for graceful shutdown
 */
export async function stopTelegramLimiter() {
  await telegramLimiter.stop({
    dropWaitingJobs: false, // Complete queued jobs
  });
  console.log('[TelegramLimiter] Stopped');
}

export default telegramLimiter;
