/**
 * @file Health check endpoint for monitoring service status
 * @module api/health
 */

import logger from '../utils/logger.js';
import { getMetrics, getMetricsContentType } from '../utils/metrics.js';

/**
 * Health status levels
 */
export const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
};

/**
 * Check database health
 * @param {Object} db - Database client instance
 * @returns {Promise<Object>} Health check result
 */
async function checkDatabase(db) {
  const startTime = Date.now();

  try {
    if (!db) {
      return {
        status: HealthStatus.CRITICAL,
        message: 'Database client not initialized',
        responseTime: Date.now() - startTime,
      };
    }

    // Execute a simple query to verify database connectivity
    await db.query('SELECT 1');

    const responseTime = Date.now() - startTime;

    // Check if response time is acceptable
    if (responseTime > 5000) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'Database responding slowly',
        responseTime,
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      message: 'Database is operational',
      responseTime,
    };
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return {
      status: HealthStatus.CRITICAL,
      message: `Database error: ${err.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check LLM API health
 * @returns {Promise<Object>} Health check result
 */
async function checkLLMApi() {
  const startTime = Date.now();

  try {
    // Check if LLM API key is configured
    const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;

    if (!apiKey) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'LLM API key not configured',
        responseTime: Date.now() - startTime,
      };
    }

    // For health check purposes, we just verify configuration exists
    // Actual API call would be too expensive to run on every health check
    return {
      status: HealthStatus.HEALTHY,
      message: 'LLM API configured',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    logger.error({ err }, 'LLM API health check failed');
    return {
      status: HealthStatus.CRITICAL,
      message: `LLM API error: ${err.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check GitHub MCP server health
 * @returns {Promise<Object>} Health check result
 */
async function checkGitHubMCP() {
  const startTime = Date.now();

  try {
    // Check if GitHub token is configured
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return {
        status: HealthStatus.DEGRADED,
        message: 'GitHub token not configured',
        responseTime: Date.now() - startTime,
      };
    }

    // For health check purposes, we just verify configuration exists
    return {
      status: HealthStatus.HEALTHY,
      message: 'GitHub MCP configured',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    logger.error({ err }, 'GitHub MCP health check failed');
    return {
      status: HealthStatus.CRITICAL,
      message: `GitHub MCP error: ${err.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Check Telegram bot health
 * @returns {Promise<Object>} Health check result
 */
async function checkTelegramBot() {
  const startTime = Date.now();

  try {
    // Check if bot token is configured
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      return {
        status: HealthStatus.CRITICAL,
        message: 'Telegram bot token not configured',
        responseTime: Date.now() - startTime,
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      message: 'Telegram bot configured',
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    logger.error({ err }, 'Telegram bot health check failed');
    return {
      status: HealthStatus.CRITICAL,
      message: `Telegram bot error: ${err.message}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Calculate overall health status from individual checks
 * @param {Object} checks - Map of health check results
 * @returns {string} Overall health status
 */
function calculateOverallStatus(checks) {
  const statuses = Object.values(checks).map((check) => check.status);

  if (statuses.includes(HealthStatus.CRITICAL)) {
    return HealthStatus.CRITICAL;
  }

  if (statuses.includes(HealthStatus.DEGRADED)) {
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.HEALTHY;
}

/**
 * Perform comprehensive health check
 * @param {Object} [dependencies] - Optional dependency instances
 * @param {Object} [dependencies.db] - Database client
 * @returns {Promise<Object>} Complete health status
 */
export async function performHealthCheck(dependencies = {}) {
  const startTime = Date.now();

  try {
    // Run all health checks in parallel
    const [database, llmApi, githubMcp, telegramBot] = await Promise.all([
      checkDatabase(dependencies.db),
      checkLLMApi(),
      checkGitHubMCP(),
      checkTelegramBot(),
    ]);

    const checks = {
      database,
      llmApi,
      githubMcp,
      telegramBot,
    };

    const overallStatus = calculateOverallStatus(checks);
    const totalResponseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: totalResponseTime,
      checks,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    return {
      status: HealthStatus.CRITICAL,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      error: err.message,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}

/**
 * Express/HTTP handler for health check endpoint
 * @param {Object} dependencies - Dependency instances (db, etc.)
 * @returns {Function} Express middleware
 */
export function healthCheckHandler(dependencies = {}) {
  return async (req, res) => {
    try {
      const healthStatus = await performHealthCheck(dependencies);

      // Set appropriate HTTP status code based on health
      let httpStatus = 200;
      if (healthStatus.status === HealthStatus.DEGRADED) {
        httpStatus = 200; // Still operational but degraded
      } else if (healthStatus.status === HealthStatus.CRITICAL) {
        httpStatus = 503; // Service unavailable
      }

      res.writeHead(httpStatus, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });

      res.end(JSON.stringify(healthStatus, null, 2));

      logger.info(
        {
          status: healthStatus.status,
          responseTime: healthStatus.responseTime,
        },
        'Health check completed'
      );
    } catch (err) {
      logger.error({ err }, 'Health check handler error');

      try {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: HealthStatus.CRITICAL,
            error: 'Health check failed',
            message: err.message,
          })
        );
      } catch (responseErr) {
        // If we can't send a response, log it but don't throw
        logger.error({ err: responseErr }, 'Failed to send error response');
      }
    }
  };
}

/**
 * Express/HTTP handler for metrics endpoint
 * @returns {Function} Express middleware
 */
export function metricsHandler() {
  return async (req, res) => {
    try {
      const metrics = await getMetrics();

      res.writeHead(200, {
        'Content-Type': getMetricsContentType(),
      });

      res.end(metrics);

      logger.debug('Metrics exported');
    } catch (err) {
      logger.error({ err }, 'Metrics handler error');

      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to export metrics');
    }
  };
}

/**
 * Readiness check handler (Kubernetes-style)
 * Checks if the service is ready to accept traffic
 * @param {Object} dependencies - Dependency instances
 * @returns {Function} Express middleware
 */
export function readinessHandler(dependencies = {}) {
  return async (req, res) => {
    try {
      const healthStatus = await performHealthCheck(dependencies);

      // Service is ready if not critical
      const isReady = healthStatus.status !== HealthStatus.CRITICAL;

      res.writeHead(isReady ? 200 : 503, {
        'Content-Type': 'application/json',
      });

      res.end(
        JSON.stringify({
          ready: isReady,
          status: healthStatus.status,
        })
      );
    } catch (err) {
      logger.error({ err }, 'Readiness check error');

      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: false }));
    }
  };
}

/**
 * Liveness check handler (Kubernetes-style)
 * Checks if the service is alive and should not be restarted
 * @returns {Function} Express middleware
 */
export function livenessHandler() {
  return (req, res) => {
    try {
      // Simple check - if we can respond, we're alive
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          alive: true,
          uptime: process.uptime(),
        })
      );
    } catch (err) {
      logger.error({ err }, 'Liveness check error');

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alive: false }));
    }
  };
}

export default {
  performHealthCheck,
  healthCheckHandler,
  metricsHandler,
  readinessHandler,
  livenessHandler,
  HealthStatus,
};
