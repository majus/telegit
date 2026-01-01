/**
 * Private message handler for GitHub setup workflow
 * Routes private messages based on user whitelist status and active session
 */

import { handleSetupMessage } from './auth-setup.js';
import logger from '../../utils/logger.js';

/**
 * Handle private messages from users
 * Routes based on whitelist status and session state
 * @param {Object} ctx - Telegraf context
 * @param {Object} filterResult - Private message filter result
 * @param {Function} [validatePatFn] - Function to validate GitHub PAT
 * @returns {Promise<void>}
 */
export async function handlePrivateMessage(ctx, filterResult, validatePatFn = null) {
  const userId = filterResult.metadata.userId;

  // Non-whitelisted users get error message
  if (!filterResult.isWhitelisted) {
    logger.warn({ userId }, 'Unauthorized private message attempt');

    await ctx.reply(
      '❌ You are not authorized to use this bot. Please contact your administrator.'
    );
    return;
  }

  // Whitelisted users route to setup workflow
  // handleSetupMessage will determine response based on session state
  try {
    await handleSetupMessage(ctx, validatePatFn);
  } catch (error) {
    logger.error({ err: error, userId }, 'Error handling private message');

    await ctx.reply(
      `❌ An error occurred while processing your message: ${error.message}\n\nPlease try again or contact support.`
    );
  }
}

/**
 * Create a private message handler factory
 * @param {Function} [validatePatFn] - Function to validate GitHub PAT
 * @returns {Function} Handler function for private messages
 */
export function createPrivateMessageHandler(validatePatFn = null) {
  return async (ctx) => {
    const filterResult = ctx.state.privateFilterResult;

    if (!filterResult) {
      logger.error('Private message handler called without filter result');
      return;
    }

    await handlePrivateMessage(ctx, filterResult, validatePatFn);
  };
}
