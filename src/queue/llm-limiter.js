/**
 * LLM API Rate Limiter
 *
 * Implements rate limiting for LLM API calls (OpenAI, Anthropic, etc.)
 * to prevent rate limit errors and manage costs.
 *
 * Default limits:
 * - 50 requests per minute (configurable)
 * - Provider-specific limits can vary significantly
 *
 * Note: Different LLM providers have different rate limits.
 * This is a conservative default that should work for most providers.
 *
 * @see https://platform.openai.com/docs/guides/rate-limits
 * @see https://docs.anthropic.com/claude/reference/rate-limits
 */

import Bottleneck from 'bottleneck';

/**
 * Get LLM rate limiter configuration from environment or use defaults
 */
function getLLMRateLimitConfig() {
  const maxConcurrent = parseInt(process.env.LLM_RATE_LIMIT_MAX_CONCURRENT || '3', 10);
  const requestsPerMinute = parseInt(process.env.LLM_RATE_LIMIT_REQUESTS_PER_MINUTE || '50', 10);
  const minTime = Math.floor(60000 / requestsPerMinute); // ms between requests

  return {
    maxConcurrent,
    minTime,
    reservoir: requestsPerMinute,
    reservoirRefreshAmount: requestsPerMinute,
    reservoirRefreshInterval: 60000, // 1 minute
  };
}

/**
 * LLM API rate limiter configuration
 *
 * Configuration:
 * - maxConcurrent: 3 - Allow 3 concurrent requests (configurable via env)
 * - minTime: ~1200ms - Minimum time between requests for 50 req/min (configurable via env)
 * - reservoir: 50 - Initial burst capacity (configurable via env)
 * - reservoirRefreshAmount: 50 - Number of requests to add on refresh
 * - reservoirRefreshInterval: 60000ms - Refresh every minute
 */
const llmLimiter = new Bottleneck(getLLMRateLimitConfig());

/**
 * Event handlers for monitoring and debugging
 */
llmLimiter.on('error', (error) => {
  console.error('[LLMLimiter] Error:', error);
});

llmLimiter.on('failed', async (error, jobInfo) => {
  console.warn('[LLMLimiter] Job failed:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });

  // Retry on rate limit errors (HTTP 429)
  if (error.status === 429 || error.message?.includes('rate limit')) {
    // Try to extract retry-after from different possible locations
    const retryAfter =
      error.response?.headers?.['retry-after'] ||
      error.headers?.['retry-after'] ||
      error.error?.['retry-after'];

    if (retryAfter) {
      const delay = parseInt(retryAfter, 10) * 1000;
      console.log(`[LLMLimiter] Rate limited, retrying after ${retryAfter}s`);
      return delay;
    }

    // Default retry with exponential backoff
    const baseDelay = 2000; // 2 seconds
    const delay = baseDelay * Math.pow(2, jobInfo.retryCount);
    const maxDelay = 60000; // Cap at 1 minute
    const actualDelay = Math.min(delay, maxDelay);
    console.log(`[LLMLimiter] Rate limited, retrying after ${actualDelay / 1000}s`);
    return actualDelay;
  }

  // Retry on timeout errors
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    console.log('[LLMLimiter] Timeout error, retrying in 3s');
    return 3000;
  }

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
    console.log('[LLMLimiter] Network error, retrying in 2s');
    return 2000;
  }

  // Retry on server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    const delay = 5000 * Math.pow(2, jobInfo.retryCount);
    const actualDelay = Math.min(delay, 30000); // Cap at 30 seconds
    console.log(`[LLMLimiter] Server error, retrying in ${actualDelay / 1000}s`);
    return actualDelay;
  }

  return null; // Don't retry for other errors
});

llmLimiter.on('retry', (error, jobInfo) => {
  console.log('[LLMLimiter] Retrying job:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });
});

llmLimiter.on('depleted', (empty) => {
  if (empty) {
    console.warn('[LLMLimiter] Reservoir depleted, requests will be queued');
  }
});

/**
 * Wrap an LLM API call with rate limiting
 *
 * @param {Function} fn - Async function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} Result of the function
 *
 * @example
 * await llmLimiter.schedule(() => llm.invoke([...]));
 */

/**
 * Get current limiter status for monitoring
 *
 * @returns {Object} Current status including counts and availability
 */
export function getLLMLimiterStatus() {
  return {
    queued: llmLimiter.counts().QUEUED,
    running: llmLimiter.counts().RUNNING,
    executing: llmLimiter.counts().EXECUTING,
    done: llmLimiter.counts().DONE,
    received: llmLimiter.counts().RECEIVED,
    config: getLLMRateLimitConfig(),
  };
}

/**
 * Update limiter settings dynamically
 * Useful for adjusting to different provider limits
 *
 * @param {Object} settings - New settings to apply
 * @param {number} [settings.maxConcurrent] - Max concurrent requests
 * @param {number} [settings.requestsPerMinute] - Requests per minute
 */
export function updateLLMLimiterSettings(settings) {
  const newConfig = {};

  if (settings.maxConcurrent !== undefined) {
    newConfig.maxConcurrent = settings.maxConcurrent;
  }

  if (settings.requestsPerMinute !== undefined) {
    newConfig.minTime = Math.floor(60000 / settings.requestsPerMinute);
    newConfig.reservoir = settings.requestsPerMinute;
    newConfig.reservoirRefreshAmount = settings.requestsPerMinute;
  }

  if (Object.keys(newConfig).length > 0) {
    llmLimiter.updateSettings(newConfig);
    console.log('[LLMLimiter] Updated settings:', newConfig);
  }
}

/**
 * Stop the limiter and reject all pending jobs
 * Useful for graceful shutdown
 */
export async function stopLLMLimiter() {
  await llmLimiter.stop({
    dropWaitingJobs: false, // Complete queued jobs
  });
  console.log('[LLMLimiter] Stopped');
}

export default llmLimiter;
