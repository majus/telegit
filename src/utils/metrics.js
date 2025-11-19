/**
 * @file Prometheus metrics collection for monitoring
 * @module utils/metrics
 */

import client from 'prom-client';
import logger from './logger.js';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'telegit_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

/**
 * Counter: Total messages processed
 */
export const messagesProcessedTotal = new client.Counter({
  name: 'telegit_messages_processed_total',
  help: 'Total number of Telegram messages processed',
  labelNames: ['status', 'intent'],
  registers: [register],
});

/**
 * Histogram: Message processing duration
 */
export const processingDuration = new client.Histogram({
  name: 'telegit_processing_duration_seconds',
  help: 'Time spent processing messages in seconds',
  labelNames: ['intent', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

/**
 * Gauge: Active operations
 */
export const activeOperations = new client.Gauge({
  name: 'telegit_active_operations',
  help: 'Number of currently active operations',
  labelNames: ['operation_type'],
  registers: [register],
});

/**
 * Counter: GitHub API calls
 */
export const githubApiCallsTotal = new client.Counter({
  name: 'telegit_github_api_calls_total',
  help: 'Total number of GitHub API calls made',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

/**
 * Histogram: GitHub API request duration
 */
export const githubApiDuration = new client.Histogram({
  name: 'telegit_github_api_duration_seconds',
  help: 'Time spent on GitHub API requests in seconds',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

/**
 * Counter: LLM API calls
 */
export const llmApiCallsTotal = new client.Counter({
  name: 'telegit_llm_api_calls_total',
  help: 'Total number of LLM API calls made',
  labelNames: ['model', 'status'],
  registers: [register],
});

/**
 * Histogram: LLM API request duration
 */
export const llmApiDuration = new client.Histogram({
  name: 'telegit_llm_api_duration_seconds',
  help: 'Time spent on LLM API requests in seconds',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

/**
 * Counter: LLM tokens used
 */
export const llmTokensUsed = new client.Counter({
  name: 'telegit_llm_tokens_used_total',
  help: 'Total number of LLM tokens used',
  labelNames: ['model', 'type'],
  registers: [register],
});

/**
 * Counter: Database queries
 */
export const databaseQueriesTotal = new client.Counter({
  name: 'telegit_database_queries_total',
  help: 'Total number of database queries executed',
  labelNames: ['operation', 'status'],
  registers: [register],
});

/**
 * Histogram: Database query duration
 */
export const databaseQueryDuration = new client.Histogram({
  name: 'telegit_database_query_duration_seconds',
  help: 'Time spent on database queries in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2],
  registers: [register],
});

/**
 * Gauge: Database connection pool size
 */
export const databaseConnectionPool = new client.Gauge({
  name: 'telegit_database_connection_pool',
  help: 'Current database connection pool status',
  labelNames: ['status'],
  registers: [register],
});

/**
 * Counter: Errors by type
 */
export const errorsTotal = new client.Counter({
  name: 'telegit_errors_total',
  help: 'Total number of errors by type',
  labelNames: ['error_type', 'severity'],
  registers: [register],
});

/**
 * Gauge: Queue backlog
 */
export const queueBacklog = new client.Gauge({
  name: 'telegit_queue_backlog',
  help: 'Number of messages waiting in queue',
  registers: [register],
});

/**
 * Start a timer for measuring duration
 * @param {Object} histogram - Prometheus histogram metric
 * @param {Object} labels - Labels for the metric
 * @returns {Function} End timer function
 */
export function startTimer(histogram, labels = {}) {
  if (!histogram) {
    return () => {}; // Return no-op function if histogram is null
  }

  const end = histogram.startTimer(labels);
  return () => {
    try {
      end();
    } catch (err) {
      logger.error({ err }, 'Error ending metric timer');
    }
  };
}

/**
 * Increment a counter metric
 * @param {Object} counter - Prometheus counter metric
 * @param {Object} labels - Labels for the metric
 * @param {number} [value=1] - Value to increment by
 */
export function incrementCounter(counter, labels = {}, value = 1) {
  if (!counter) {
    return; // Do nothing if counter is null
  }

  try {
    counter.inc(labels, value);
  } catch (err) {
    logger.error({ err, counter: counter.name, labels }, 'Error incrementing counter');
  }
}

/**
 * Set a gauge metric value
 * @param {Object} gauge - Prometheus gauge metric
 * @param {Object} labels - Labels for the metric
 * @param {number} value - Value to set
 */
export function setGauge(gauge, labels = {}, value) {
  if (!gauge) {
    return; // Do nothing if gauge is null
  }

  try {
    gauge.set(labels, value);
  } catch (err) {
    logger.error({ err, gauge: gauge.name, labels, value }, 'Error setting gauge');
  }
}

/**
 * Increment a gauge metric
 * @param {Object} gauge - Prometheus gauge metric
 * @param {Object} labels - Labels for the metric
 * @param {number} [value=1] - Value to increment by
 */
export function incrementGauge(gauge, labels = {}, value = 1) {
  if (!gauge) {
    return; // Do nothing if gauge is null
  }

  try {
    gauge.inc(labels, value);
  } catch (err) {
    logger.error({ err, gauge: gauge.name, labels, value }, 'Error incrementing gauge');
  }
}

/**
 * Decrement a gauge metric
 * @param {Object} gauge - Prometheus gauge metric
 * @param {Object} labels - Labels for the metric
 * @param {number} [value=1] - Value to decrement by
 */
export function decrementGauge(gauge, labels = {}, value = 1) {
  if (!gauge) {
    return; // Do nothing if gauge is null
  }

  try {
    gauge.dec(labels, value);
  } catch (err) {
    logger.error({ err, gauge: gauge.name, labels, value }, 'Error decrementing gauge');
  }
}

/**
 * Track message processing with metrics
 * @param {Function} fn - Function to execute
 * @param {string} intent - Message intent
 * @returns {Promise<*>} Result of the function
 */
export async function trackMessageProcessing(fn, intent) {
  const endTimer = startTimer(processingDuration, { intent, status: 'success' });
  incrementGauge(activeOperations, { operation_type: 'message_processing' });

  try {
    const result = await fn();
    incrementCounter(messagesProcessedTotal, { status: 'success', intent });
    endTimer();
    return result;
  } catch (err) {
    incrementCounter(messagesProcessedTotal, { status: 'error', intent });
    incrementCounter(errorsTotal, { error_type: 'message_processing', severity: 'error' });
    throw err;
  } finally {
    decrementGauge(activeOperations, { operation_type: 'message_processing' });
  }
}

/**
 * Track GitHub API call with metrics
 * @param {Function} fn - Function to execute
 * @param {string} endpoint - API endpoint
 * @returns {Promise<*>} Result of the function
 */
export async function trackGitHubApiCall(fn, endpoint) {
  const endTimer = startTimer(githubApiDuration, { endpoint });

  try {
    const result = await fn();
    incrementCounter(githubApiCallsTotal, { endpoint, status: 'success' });
    endTimer();
    return result;
  } catch (err) {
    incrementCounter(githubApiCallsTotal, { endpoint, status: 'error' });
    incrementCounter(errorsTotal, { error_type: 'github_api', severity: 'error' });
    throw err;
  }
}

/**
 * Track LLM API call with metrics
 * @param {Function} fn - Function to execute
 * @param {string} model - LLM model name
 * @param {Object} [tokenUsage] - Token usage information
 * @returns {Promise<*>} Result of the function
 */
export async function trackLLMApiCall(fn, model, tokenUsage = null) {
  const endTimer = startTimer(llmApiDuration, { model });

  try {
    const result = await fn();
    incrementCounter(llmApiCallsTotal, { model, status: 'success' });

    // Track token usage if provided
    if (tokenUsage) {
      if (tokenUsage.promptTokens) {
        incrementCounter(llmTokensUsed, { model, type: 'prompt' }, tokenUsage.promptTokens);
      }
      if (tokenUsage.completionTokens) {
        incrementCounter(llmTokensUsed, { model, type: 'completion' }, tokenUsage.completionTokens);
      }
    }

    endTimer();
    return result;
  } catch (err) {
    incrementCounter(llmApiCallsTotal, { model, status: 'error' });
    incrementCounter(errorsTotal, { error_type: 'llm_api', severity: 'error' });
    throw err;
  }
}

/**
 * Track database query with metrics
 * @param {Function} fn - Function to execute
 * @param {string} operation - Database operation name
 * @returns {Promise<*>} Result of the function
 */
export async function trackDatabaseQuery(fn, operation) {
  const endTimer = startTimer(databaseQueryDuration, { operation });

  try {
    const result = await fn();
    incrementCounter(databaseQueriesTotal, { operation, status: 'success' });
    endTimer();
    return result;
  } catch (err) {
    incrementCounter(databaseQueriesTotal, { operation, status: 'error' });
    incrementCounter(errorsTotal, { error_type: 'database', severity: 'error' });
    throw err;
  }
}

/**
 * Get all metrics in Prometheus format
 * @returns {Promise<string>} Metrics in Prometheus exposition format
 */
export async function getMetrics() {
  try {
    return await register.metrics();
  } catch (err) {
    logger.error({ err }, 'Error getting metrics');
    throw err;
  }
}

/**
 * Get metrics content type
 * @returns {string} Content type for Prometheus metrics
 */
export function getMetricsContentType() {
  return register.contentType;
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics() {
  register.resetMetrics();
}

// Export the register for custom use cases
export { register };

// Export default object with all functions
export default {
  messagesProcessedTotal,
  processingDuration,
  activeOperations,
  githubApiCallsTotal,
  githubApiDuration,
  llmApiCallsTotal,
  llmApiDuration,
  llmTokensUsed,
  databaseQueriesTotal,
  databaseQueryDuration,
  databaseConnectionPool,
  errorsTotal,
  queueBacklog,
  startTimer,
  incrementCounter,
  setGauge,
  incrementGauge,
  decrementGauge,
  trackMessageProcessing,
  trackGitHubApiCall,
  trackLLMApiCall,
  trackDatabaseQuery,
  getMetrics,
  getMetricsContentType,
  resetMetrics,
  register,
};
