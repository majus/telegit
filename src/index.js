/**
 * TeleGit - Main Entry Point
 * Initializes and starts the Telegram bot with AI-powered GitHub integration
 */

import express from 'express';
import { loadConfig } from '../config/env.js';
import logger from './utils/logger.js';
import { testConnection, closePool } from './database/db.js';
import { initializeBot, getBotInfo } from './services/telegram/bot.js';
import { createMessageHandler, handleEditedMessage } from './services/telegram/handlers.js';
import { handleReaction } from './services/telegram/reaction-handler.js';
import { createFilterMiddleware } from './services/telegram/filters.js';
import { createPrivateMessageHandler } from './services/telegram/private-message-handler.js';
import { getSetupSession, cleanupExpiredSessions } from './services/telegram/auth-setup.js';
import {
  createStartCommandHandler,
  createUnlinkCommandHandler,
  createUnlinkCallbackHandler,
  createStatusCommandHandler,
} from './services/telegram/commands.js';
import { processMessage } from './ai/processor.js';
import { messageQueue, Priority } from './queue/message-queue.js';
import { query } from './database/db.js';
import {
  healthCheckHandler,
  metricsHandler,
  readinessHandler,
  livenessHandler,
} from './api/health.js';

/**
 * Global state
 */
let server = null;
let bot = null;
let isShuttingDown = false;

/**
 * Initialize and start the application
 */
async function startApplication() {
  try {
    logger.info('🚀 Starting TeleGit...');

    // Step 1: Load and validate configuration
    logger.info('Loading configuration...');
    const config = loadConfig();
    const useWebhook = config.app.nodeEnv === 'production';
    logger.info({
      nodeEnv: config.app.nodeEnv,
      logLevel: config.app.logLevel,
      mode: useWebhook ? 'webhook' : 'polling',
    }, 'Configuration loaded successfully');

    // Step 2: Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('✓ Database connection successful');

    // Step 3: Initialize Telegram bot
    logger.info('Initializing Telegram bot...');
    bot = initializeBot({ token: config.telegram.botToken });
    const botInfo = await getBotInfo(bot);
    logger.info({
      username: botInfo.username,
      id: botInfo.id,
      firstName: botInfo.first_name,
    }, '✓ Bot initialized');

    // Step 4: Build filter options from config
    const filterOptions = {
      allowedChatIds: config.telegram.allowedChatIds,
      allowedUserIds: config.telegram.allowedUserIds,
      hasActiveSession: (userId) => getSetupSession(userId) !== null,
      logFiltered: config.app.logLevel === 'debug',
    };

    // Step 5: Register middleware and handlers
    logger.info('Registering bot handlers...');
    registerBotHandlers(bot, filterOptions);
    logger.info('✓ Bot handlers registered');

    // Step 6: Setup session cleanup interval (every 5 minutes)
    const sessionCleanupInterval = setInterval(() => {
      const cleaned = cleanupExpiredSessions();
      if (cleaned > 0) {
        logger.info({ count: cleaned }, 'Cleaned up expired setup sessions');
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Store interval for cleanup during shutdown
    global.sessionCleanupInterval = sessionCleanupInterval;

    // Step 7: Create Express app
    logger.info('Creating Express application...');
    const app = express();

    // Step 8: Mount health check routes
    const dbDependency = { db: { query } };
    app.get('/api/health', healthCheckHandler(dbDependency));
    app.get('/api/metrics', metricsHandler());
    app.get('/api/ready', readinessHandler(dbDependency));
    app.get('/api/live', livenessHandler());
    logger.info('✓ Health check routes mounted');

    // Step 9: Mount Telegraf webhook (production only)
    if (useWebhook) {
      const webhookDomain = process.env.WEBHOOK_DOMAIN;
      const webhookPath = process.env.WEBHOOK_PATH || '/telegram-webhook';

      if (!webhookDomain) {
        throw new Error('WEBHOOK_DOMAIN is required in production mode');
      }

      logger.info({ webhookDomain, webhookPath }, 'Setting up webhook');

      // Mount Telegraf webhook middleware
      app.use(await bot.createWebhook({ domain: webhookDomain, path: webhookPath }));

      logger.info('✓ Webhook middleware mounted');
    } else {
      logger.info('Starting bot in polling mode...');
      await bot.launch({
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'message_reaction', 'edited_message', 'callback_query'],
      });
      logger.info('✓ Bot started in polling mode');
    }

    // Step 10: Start Express server
    const port = config.app.port;
    server = app.listen(port, () => {
      logger.info({ port, mode: useWebhook ? 'webhook' : 'polling' }, '✓ Express server started');
    });

    // Step 11: Setup graceful shutdown
    setupGracefulShutdown();

    logger.info('✅ TeleGit is running!');
    logger.info({
      botUsername: botInfo.username,
      mode: useWebhook ? 'webhook' : 'polling',
      port,
    }, 'Application started successfully');
  } catch (error) {
    logger.fatal({ err: error }, '❌ Failed to start application');
    process.exit(1);
  }
}

/**
 * Register bot middleware and handlers
 * @param {Object} botInstance - Telegraf bot instance
 * @param {Object} filterOptions - Filter options for message filtering
 */
function registerBotHandlers(botInstance, filterOptions) {
  // Middleware: Store bot info in context
  botInstance.use(async (ctx, next) => {
    if (!ctx.botInfo) {
      ctx.botInfo = await getBotInfo(botInstance);
    }
    return next();
  });

  // Middleware: Filter messages using factory
  botInstance.use(createFilterMiddleware(filterOptions));

  // Register command handlers
  botInstance.command('start', createStartCommandHandler({ filterOptions }));
  botInstance.command('status', createStatusCommandHandler());
  botInstance.command('unlink', createUnlinkCommandHandler());
  botInstance.on('callback_query', createUnlinkCallbackHandler());

  // Create private message handler
  const privateMessageHandler = createPrivateMessageHandler();

  // Handler: New messages - route based on message type
  botInstance.on('message', async (ctx) => {
    if (ctx.state.isPrivateMessage) {
      // Route private messages to setup handler
      await privateMessageHandler(ctx);
    } else if (ctx.state.isGroupMessage) {
      // Route group messages to AI workflow
      const handler = createMessageHandler(queueMessageProcessing);
      await handler(ctx);
    }
  });

  // Handler: Edited messages - only process group messages
  botInstance.on('edited_message', async (ctx) => {
    // Skip private messages for edited_message
    if (ctx.state.isPrivateMessage) {
      logger.debug({ userId: ctx.from?.id }, 'Skipping edited private message');
      return;
    }

    if (ctx.state.isGroupMessage) {
      await handleEditedMessage(ctx, queueMessageProcessing);
    }
  });

  // Handler: Message reactions (for undo/dismiss)
  botInstance.on('message_reaction', async (ctx) => {
    await handleReaction(ctx);
  });

  // Error handler
  botInstance.catch((err, ctx) => {
    logger.error({
      err,
      updateType: ctx.updateType,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    }, 'Bot error');
  });
}

/**
 * Queue message for AI processing
 * This function is passed to message handlers
 */
async function queueMessageProcessing(ctx, operationId, threadContext) {
  const message = ctx.message || ctx.editedMessage;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Determine priority based on context
  let priority = Priority.NORMAL;
  if (ctx.state?.filterResult?.metadata?.botMentioned) {
    priority = Priority.HIGH;
  }

  // Queue the processing
  return messageQueue.add(
    async () => {
      logger.debug({
        chatId,
        messageId,
        operationId,
      }, 'Processing message from queue');

      // Process the message through AI workflow
      const result = await processMessage(message, {
        skipContextGathering: true,
        threadContext,
        operationId,
      });

      return result;
    },
    {
      priority,
      id: `${chatId}:${messageId}`,
      context: {
        chatId,
        messageId,
        operationId,
      },
    }
  );
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    if (isShuttingDown) {
      logger.info('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Received shutdown signal');

    try {
      // Step 1: Clear session cleanup interval
      if (global.sessionCleanupInterval) {
        clearInterval(global.sessionCleanupInterval);
        logger.info('✓ Session cleanup interval cleared');
      }

      // Step 2: Stop accepting new messages
      logger.info('Stopping bot...');
      if (bot) {
        await bot.stop();
        logger.info('✓ Bot stopped');
      }

      // Step 3: Wait for message queue to empty (with timeout)
      logger.info('Waiting for message queue to empty...');
      const queueEmptied = await messageQueue.waitForEmpty(30000);
      if (queueEmptied) {
        logger.info('✓ Message queue emptied');
      } else {
        logger.warn('⚠ Message queue timeout - forcing shutdown with pending messages');
      }

      // Step 4: Close HTTP server
      if (server) {
        logger.info('Closing HTTP server...');
        await new Promise((resolve) => {
          server.close(() => {
            logger.info('✓ HTTP server closed');
            resolve();
          });
        });
      }

      // Step 5: Close database connections
      logger.info('Closing database connections...');
      await closePool();
      logger.info('✓ Database connections closed');

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, '❌ Error during shutdown');
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Promise Rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    shutdown('uncaughtException');
  });
}

// Start the application
startApplication().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error during startup');
  process.exit(1);
});
