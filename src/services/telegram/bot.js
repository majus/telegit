/**
 * Telegraf Bot initialization and lifecycle management
 * Handles bot setup, webhook/polling configuration, and graceful shutdown
 */

import { Telegraf } from 'telegraf';
import { getConfig } from '../../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('telegraf').Telegraf} TelegrafBot
 * @typedef {import('../../types/bot.js').BotOptions} BotOptions
 */

let bot = null;
let isShuttingDown = false;

/**
 * Initialize Telegraf bot instance
 * @param {BotOptions} [options] - Configuration options for the bot
 * @returns {Telegraf} Initialized Telegraf bot instance
 */
export function initializeBot(options = {}) {
  const config = getConfig();

  // Use provided token or get from config
  const token = options.token || config.telegram.botToken;

  if (!token) {
    throw new Error('Telegram bot token is required');
  }

  // Create Telegraf instance
  bot = new Telegraf(token);

  // Set up error handling
  bot.catch((err, ctx) => {
    logger.error({
      err,
      updateType: ctx.updateType,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    }, 'Bot error occurred');
  });

  // Log bot initialization
  logger.info('Telegraf bot initialized successfully');

  return bot;
}

/**
 * Start the bot with webhook (production) or polling (development)
 * @param {Telegraf} botInstance - The Telegraf bot instance
 * @param {BotOptions} [options] - Configuration options
 * @returns {Promise<void>}
 */
export async function startBot(botInstance = bot, options = {}) {
  if (!botInstance) {
    throw new Error('Bot instance is not initialized. Call initializeBot() first.');
  }

  const config = getConfig();
  const useWebhook = options.useWebhook ?? (config.app.nodeEnv === 'production');

  try {
    if (useWebhook) {
      // Webhook mode (production)
      const webhookDomain = options.webhookDomain;
      const webhookPath = options.webhookPath || '/telegram-webhook';

      if (!webhookDomain) {
        throw new Error('webhookDomain is required for webhook mode');
      }

      const webhookUrl = `${webhookDomain}${webhookPath}`;

      logger.info({ webhookUrl }, 'Starting bot in webhook mode');

      await botInstance.telegram.setWebhook(webhookUrl);
      logger.info('Webhook set successfully');

      // In webhook mode, the actual server startup is handled separately
      // This just configures the webhook
    } else {
      // Polling mode (development)
      logger.info('Starting bot in polling mode');

      // Configure polling options
      const launchOptions = {
        dropPendingUpdates: options.dropPendingUpdates ?? true,
        allowedUpdates: options.allowedUpdates || [
          'message',
          'message_reaction',
          'edited_message',
        ],
      };

      await botInstance.launch(launchOptions);
      logger.info('Bot started successfully in polling mode');
    }

    // Setup graceful shutdown handlers
    setupGracefulShutdown(botInstance);
  } catch (error) {
    logger.error({ err: error }, 'Failed to start bot');
    throw error;
  }
}

/**
 * Stop the bot gracefully
 * @param {Telegraf} botInstance - The Telegraf bot instance
 * @returns {Promise<void>}
 */
export async function stopBot(botInstance = bot) {
  if (!botInstance) {
    logger.warn('No bot instance to stop');
    return;
  }

  if (isShuttingDown) {
    logger.info('Bot is already shutting down');
    return;
  }

  isShuttingDown = true;

  try {
    logger.info('Stopping bot gracefully');
    await botInstance.stop();
    logger.info('Bot stopped successfully');
  } catch (error) {
    logger.error({ err: error }, 'Error stopping bot');
    throw error;
  } finally {
    isShuttingDown = false;
    bot = null;
  }
}

/**
 * Setup graceful shutdown handlers for SIGINT and SIGTERM
 * @param {Telegraf} botInstance - The Telegraf bot instance
 */
function setupGracefulShutdown(botInstance) {
  // Enable graceful stop
  process.once('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await stopBot(botInstance);
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await stopBot(botInstance);
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled Rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught Exception');
    stopBot(botInstance).then(() => {
      process.exit(1);
    });
  });
}

/**
 * Get the current bot instance
 * @returns {Telegraf | null} Current bot instance or null if not initialized
 */
export function getBot() {
  return bot;
}

/**
 * Check if bot is currently running
 * @returns {boolean} True if bot is running, false otherwise
 */
export function isBotRunning() {
  return bot !== null && !isShuttingDown;
}

/**
 * Get bot info (username, id, etc.)
 * @param {Telegraf} botInstance - The Telegraf bot instance
 * @returns {Promise<Object>} Bot information
 */
export async function getBotInfo(botInstance = bot) {
  if (!botInstance) {
    throw new Error('Bot instance is not initialized');
  }

  try {
    const botInfo = await botInstance.telegram.getMe();
    return botInfo;
  } catch (error) {
    logger.error({ err: error }, 'Failed to get bot info');
    throw error;
  }
}
