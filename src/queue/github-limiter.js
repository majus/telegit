/**
 * GitHub API Rate Limiter
 *
 * Implements rate limiting for GitHub API to stay within API limits and prevent errors.
 *
 * GitHub API limits:
 * - 5000 requests per hour for authenticated requests
 * - ~83 requests per minute average
 * - Secondary rate limits for specific endpoints
 *
 * @see https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
 */

import Bottleneck from 'bottleneck';

/**
 * GitHub API rate limiter configuration
 *
 * Configuration:
 * - maxConcurrent: 2 - Allow 2 concurrent requests
 * - minTime: 720ms - Minimum time between requests (~83 requests/min)
 * - reservoir: 100 - Initial burst capacity
 * - reservoirRefreshAmount: 83 - Number of requests to add on refresh
 * - reservoirRefreshInterval: 60000ms - Refresh every minute
 */
const githubLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 720, // ~83 requests/min (60000ms / 83 ≈ 722ms)
  reservoir: 100,
  reservoirRefreshAmount: 83,
  reservoirRefreshInterval: 60000, // 1 minute
});

/**
 * Event handlers for monitoring and debugging
 */
githubLimiter.on('error', (error) => {
  console.error('[GitHubLimiter] Error:', error);
});

githubLimiter.on('failed', async (error, jobInfo) => {
  console.warn('[GitHubLimiter] Job failed:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });

  // Retry on rate limit errors (HTTP 403 with rate limit or 429)
  if (error.status === 403 || error.status === 429) {
    // GitHub provides reset time in response headers
    const resetTime = error.response?.headers?.['x-ratelimit-reset'];
    const retryAfter = error.response?.headers?.['retry-after'];

    if (resetTime) {
      const delay = Math.max(0, resetTime * 1000 - Date.now());
      console.log(`[GitHubLimiter] Rate limited, retrying after ${Math.ceil(delay / 1000)}s`);
      return Math.min(delay, 60000); // Cap at 1 minute
    }

    if (retryAfter) {
      const delay = parseInt(retryAfter, 10) * 1000;
      console.log(`[GitHubLimiter] Rate limited, retrying after ${retryAfter}s`);
      return delay;
    }

    // Default retry after 60 seconds for rate limit
    console.log('[GitHubLimiter] Rate limited, retrying after 60s');
    return 60000;
  }

  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    console.log('[GitHubLimiter] Network error, retrying in 2s');
    return 2000;
  }

  // Retry on server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    console.log('[GitHubLimiter] Server error, retrying in 5s');
    return 5000;
  }

  return null; // Don't retry for other errors
});

githubLimiter.on('retry', (error, jobInfo) => {
  console.log('[GitHubLimiter] Retrying job:', {
    error: error.message,
    retryCount: jobInfo.retryCount,
  });
});

githubLimiter.on('depleted', (empty) => {
  if (empty) {
    console.warn('[GitHubLimiter] Reservoir depleted, requests will be queued');
  }
});

/**
 * Wrap a GitHub API call with rate limiting
 *
 * @param {Function} fn - Async function to execute
 * @param {...any} args - Arguments to pass to the function
 * @returns {Promise<any>} Result of the function
 *
 * @example
 * await githubLimiter.schedule(() => octokit.rest.issues.create({...}));
 */

/**
 * Get current limiter status for monitoring
 *
 * @returns {Object} Current status including counts and availability
 */
export function getGitHubLimiterStatus() {
  return {
    queued: githubLimiter.counts().QUEUED,
    running: githubLimiter.counts().RUNNING,
    executing: githubLimiter.counts().EXECUTING,
    done: githubLimiter.counts().DONE,
    received: githubLimiter.counts().RECEIVED,
  };
}

/**
 * Update reservoir based on GitHub API response headers
 * This allows us to stay in sync with actual GitHub limits
 *
 * @param {Object} headers - Response headers from GitHub API
 */
export function updateGitHubLimiterFromHeaders(headers) {
  const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
  const limit = parseInt(headers['x-ratelimit-limit'], 10);

  if (!isNaN(remaining) && !isNaN(limit)) {
    // Update reservoir to match actual remaining requests
    githubLimiter.updateSettings({
      reservoir: remaining,
    });

    console.log(`[GitHubLimiter] Updated reservoir: ${remaining}/${limit} remaining`);
  }
}

/**
 * Stop the limiter and reject all pending jobs
 * Useful for graceful shutdown
 */
export async function stopGitHubLimiter() {
  await githubLimiter.stop({
    dropWaitingJobs: false, // Complete queued jobs
  });
  console.log('[GitHubLimiter] Stopped');
}

export default githubLimiter;
