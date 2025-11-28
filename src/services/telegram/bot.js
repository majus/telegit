/**
 * Telegraf Bot initialization
 * Handles bot instance creation and configuration
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
