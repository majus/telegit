/**
 * Main message processing handler
 * Coordinates message filtering, authentication, and queueing for AI processing
 */

import { filterMessage } from './filters.js';
import { isGroupAuthenticated } from './auth-check.js';
import { setAnalyzingReaction, setErrorReaction } from './reactions.js';
import { gatherThreadContext } from './thread-context.js';
import { postFeedback } from './feedback.js';
import { startSetupSession } from './auth-setup.js';
import { OperationsRepository } from '../../database/repositories/operations.js';
import logger from '../../utils/logger.js';

/**
 * @typedef {import('telegraf').Context} Context
 */

/**
 * Main message handler for processing triggered messages
 * This is the entry point for all bot-triggered messages
 * @param {Context} ctx - Telegraf context
 * @param {Function} processMessageFn - Function to process the message (AI pipeline)
 * @returns {Promise<void>}
 */
export async function handleMessage(ctx, processMessageFn) {
  const message = ctx.message || ctx.editedMessage;
  if (!message) return;

  const chatId = message.chat.id;
  const messageId = message.message_id;
  const userId = message.from?.id;

  try {
    // Step 1: Filter message
    const filterResult = ctx.state.filterResult || filterMessage(ctx);

    if (!filterResult.shouldProcess) {
      // Message was filtered out (already handled by middleware)
      return;
    }

    logger.info({
      chatId,
      messageId,
      userId,
      botMentioned: filterResult.metadata.botMentioned,
      hashtags: filterResult.metadata.hashtags,
    }, 'Processing triggered message');

    // Step 2: Check GitHub authentication
    const isAuthenticated = await isGroupAuthenticated(chatId);

    if (!isAuthenticated) {
      logger.info({ chatId }, 'Group not authenticated, sending setup instructions');

      // Send authentication required message
      await sendAuthRequiredMessage(ctx);
      return;
    }

    // Step 3: Set "analyzing" reaction
    await setAnalyzingReaction(chatId, messageId);

    // Step 4: Gather conversation context if this is a reply
    let threadContext = [];
    try {
      threadContext = await gatherThreadContext(ctx);
    } catch (error) {
      logger.error({ err: error }, 'Failed to gather thread context');
      // Non-fatal, continue with empty context
    }

    // Step 5: Create operation record
    const operationsRepo = new OperationsRepository();
    const operation = await operationsRepo.createOperation({
      telegramGroupId: chatId,
      telegramMessageId: messageId,
      telegramUserId: userId,
      operationType: 'pending', // Will be updated by AI processor
      status: 'queued',
      messageText: message.text || message.caption || '',
      metadata: {
        hashtags: filterResult.metadata.hashtags,
        botMentioned: filterResult.metadata.botMentioned,
        threadContext: threadContext.length > 1,
      },
    });

    logger.info({
      operationId: operation.id,
      chatId,
      messageId,
    }, 'Operation created');

    // Step 6: Queue message for AI processing
    if (processMessageFn) {
      // Process in background (don't await)
      processMessageFn(ctx, operation.id, threadContext)
        .catch((error) => {
          logger.error({
            err: error,
            operationId: operation.id,
          }, 'Message processing failed');

          // Set error reaction
          setErrorReaction(chatId, messageId);

          // Update operation status
          operationsRepo.updateOperationStatus(operation.id, 'failed', {
            error: error.message,
          });
        });
    } else {
      logger.warn('No message processor function provided');
    }
  } catch (error) {
    logger.error({
      err: error,
      chatId,
      messageId,
    }, 'Message handler error');

    // Set error reaction
    await setErrorReaction(chatId, messageId);

    // Post error feedback
    try {
      await ctx.reply(
        '😵‍💫 Oops! Something went wrong while processing your message. Please try again.',
        { reply_to_message_id: messageId }
      );
    } catch (replyError) {
      logger.error({ err: replyError }, 'Failed to send error reply');
    }
  }
}

/**
 * Send authentication required message to the group
 * Instructs the user to set up GitHub authentication via DM
 * @param {Context} ctx - Telegraf context
 * @returns {Promise<void>}
 */
async function sendAuthRequiredMessage(ctx) {
  const message = ctx.message || ctx.editedMessage;
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const firstName = message.from?.first_name || 'there';

  try {
    const authMessage = `👋 Hi ${firstName}!

🔐 This group hasn't been set up with GitHub yet.

To get started, please:
1. Send me a direct message (DM) at @${ctx.botInfo.username}
2. Follow the setup instructions to configure your GitHub repository

Once configured, I'll be able to create and manage GitHub issues from this chat!`;

    await ctx.reply(authMessage, {
      reply_to_message_id: message.message_id,
    });

    // Create a setup session for the user
    startSetupSession(userId, chatId);
    logger.debug({ userId, chatId }, 'Created setup session for user');

    // Also try to send a DM to guide the user
    try {
      await ctx.telegram.sendMessage(
        userId,
        `👋 Hi ${firstName}!

Let's set up GitHub integration for your group chat.

I'll need:
1. Your GitHub repository URL (e.g., https://github.com/owner/repo)
2. A GitHub Personal Access Token (PAT) with \`repo\` permissions

Ready? Send me your repository URL to get started!`
      );
      logger.debug({ userId }, 'Setup DM sent successfully');
    } catch (dmError) {
      // User might not have started a conversation with the bot
      logger.debug({ err: dmError, userId }, 'Could not send DM to user (they may need to start the bot first)');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to send auth required message');
  }
}

/**
 * Create a Telegraf middleware for message handling
 * @param {Function} processMessageFn - Function to process messages
 * @returns {Function} Telegraf middleware
 */
export function createMessageHandler(processMessageFn) {
  return async (ctx) => {
    await handleMessage(ctx, processMessageFn);
  };
}

/**
 * Handle edited messages
 * For now, we treat edited messages the same as new messages
 * @param {Context} ctx - Telegraf context
 * @param {Function} processMessageFn - Function to process the message
 * @returns {Promise<void>}
 */
export async function handleEditedMessage(ctx, processMessageFn) {
  // Treat edited messages the same as new messages
  await handleMessage(ctx, processMessageFn);
}
