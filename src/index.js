/**
 * TeleGit Main Application Entry Point
 * @module index
 */

import http from 'http';
import { loadConfig, validateEnv } from '../config/env.js';
import logger from './utils/logger.js';
import { healthCheckHandler, metricsHandler, livenessHandler, readinessHandler } from './api/health.js';
import { getClient } from './database/db.js';

// Validate environment on startup
try {
  validateEnv();
  logger.info('Environment validation passed');
} catch (err) {
  logger.error({ err }, 'Environment validation failed');
  process.exit(1);
}

// Load configuration
const config = loadConfig();

// Initialize database client
const db = getClient();

// Create HTTP server for health checks and metrics
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Route handling
  if (url.pathname === '/health') {
    healthCheckHandler({ db })(req, res);
  } else if (url.pathname === '/health/liveness') {
    livenessHandler()(req, res);
  } else if (url.pathname === '/health/readiness') {
    readinessHandler({ db })(req, res);
  } else if (url.pathname === '/metrics') {
    metricsHandler()(req, res);
  } else if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'TeleGit',
      version: '1.0.0',
      status: 'running',
      description: 'AI-powered Telegram bot for GitHub issue management',
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = process.env.PORT || 3000;

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, env: config.app.nodeEnv }, 'TeleGit HTTP server started');
});

// Initialize Telegram bot (TODO: implement when bot service is ready)
// import { initBot } from './services/telegram/bot.js';
// const bot = initBot(config);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info({ signal }, 'Received shutdown signal');

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop bot (TODO: implement when bot service is ready)
  // if (bot) {
  //   bot.stop();
  // }

  // Close database connections
  try {
    await db.end();
    logger.info('Database connections closed');
  } catch (err) {
    logger.error({ err }, 'Error closing database connections');
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  process.exit(1);
});

export default server;
