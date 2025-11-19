/**
 * Telegraf Bot initialization and lifecycle management
 * Handles bot setup, webhook/polling configuration, and graceful shutdown
 */

import { Telegraf } from 'telegraf';
import { getConfig } from '../../../config/env.js';

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
    console.error('Bot error occurred:', err);
    console.error('Error context:', {
      updateType: ctx.updateType,
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
  });

  // Log bot initialization
  console.log('Telegraf bot initialized successfully');

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

      console.log('Starting bot in webhook mode...');
      console.log(`Webhook URL: ${webhookUrl}`);

      await botInstance.telegram.setWebhook(webhookUrl);
      console.log('Webhook set successfully');

      // In webhook mode, the actual server startup is handled separately
      // This just configures the webhook
    } else {
      // Polling mode (development)
      console.log('Starting bot in polling mode...');

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
      console.log('Bot started successfully in polling mode');
    }

    // Setup graceful shutdown handlers
    setupGracefulShutdown(botInstance);
  } catch (error) {
    console.error('Failed to start bot:', error);
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
    console.warn('No bot instance to stop');
    return;
  }

  if (isShuttingDown) {
    console.log('Bot is already shutting down...');
    return;
  }

  isShuttingDown = true;

  try {
    console.log('Stopping bot gracefully...');
    await botInstance.stop();
    console.log('Bot stopped successfully');
  } catch (error) {
    console.error('Error stopping bot:', error);
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
    console.log('Received SIGINT signal');
    await stopBot(botInstance);
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    console.log('Received SIGTERM signal');
    await stopBot(botInstance);
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
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
    console.error('Failed to get bot info:', error);
    throw error;
  }
}
