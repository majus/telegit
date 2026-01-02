/**
 * Group Chat Commands
 * Implements /start, /status, and /unlink commands for group management
 */

import { Markup } from 'telegraf';
import { ConfigRepository } from '../../database/repositories/config.js';
import { OperationsRepository } from '../../database/repositories/operations.js';
import { ConversationContextRepository } from '../../database/repositories/context.js';
import { FeedbackRepository } from '../../database/repositories/feedback.js';
import { testConnection } from '../../database/db.js';
import { createLLMClient } from '../../ai/llm-client.js';
import { GitHubTools } from '../../integrations/github/github-tools.js';
import { isGroupAuthenticated, isGroupManager, getGitHubConfig } from './auth-check.js';
import { startSetupSession } from './auth-setup.js';
import { isFromAllowedChat, isFromAllowedUser } from './filters.js';
import logger from '../../utils/logger.js';

const startTime = Date.now();

/**
 * Check if context is a group chat
 * @param {Object} ctx - Telegraf context
 * @returns {boolean} True if group chat
 */
export function isGroupChat(ctx) {
  const chatType = ctx.chat?.type;
  return chatType === 'group' || chatType === 'supergroup';
}

/**
 * Format uptime in human-readable format
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
export function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Format operations breakdown with emoji indicators
 * @param {Array} operations - Operations array from database
 * @returns {string} Formatted breakdown text
 */
export function formatOperationsBreakdown(operations) {
  const typeMap = {
    create_bug: '👾',
    create_task: '🫡',
    create_idea: '🦄',
    update_issue: '✏️',
    close_issue: '✅',
    search_issues: '🔍',
  };

  const breakdown = {};
  for (const op of operations) {
    const type = op.operationType;
    if (!breakdown[type]) {
      breakdown[type] = { count: 0, emoji: typeMap[type] || '📝' };
    }
    breakdown[type].count++;
  }

  const lines = Object.entries(breakdown).map(
    ([type, data]) => `  ${data.emoji} ${type.replace(/_/g, ' ')}: ${data.count}`
  );

  return lines.length > 0 ? lines.join('\n') : '  (none)';
}

/**
 * Gather operation statistics for a group
 * @param {number} groupId - Telegram group ID
 * @returns {Promise<Object>} Statistics object
 */
export async function gatherOperationStats(groupId) {
  const opsRepo = new OperationsRepository();
  const contextRepo = new ConversationContextRepository();
  const feedbackRepo = new FeedbackRepository();

  const operations = await opsRepo.getOperationsByGroup(groupId);

  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    undone: 0,
  };

  for (const op of operations) {
    const status = op.status || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  const contextCount = await contextRepo.getContextCountByGroup(groupId);
  const feedbackCount = await feedbackRepo.getPendingFeedbackCount(groupId);

  return {
    total: operations.length,
    byStatus: statusCounts,
    operations,
    contextCount,
    feedbackCount,
  };
}

/**
 * Create /start command handler
 * @param {Object} dependencies - Injected dependencies
 * @param {Object} dependencies.filterOptions - Filter options for access control
 * @returns {Function} Command handler function
 */
export function createStartCommandHandler(dependencies = {}) {
  const { filterOptions = {} } = dependencies;

  return async (ctx) => {
    try {
      if (!isGroupChat(ctx)) {
        await ctx.reply('❌ This command only works in group chats.');
        return;
      }

      const groupId = ctx.chat.id;
      const userId = ctx.from?.id;

      const chatAllowed = isFromAllowedChat(ctx, filterOptions.allowedChatIds);
      const userAllowed = isFromAllowedUser(ctx, filterOptions.allowedUserIds);

      if (!chatAllowed) {
        await ctx.reply(
          `❌ This group is not authorized to use the bot.\n\nPlease contact the bot administrator to add this group to the whitelist.`
        );
        return;
      }

      if (!userAllowed) {
        await ctx.reply(
          `❌ You are not authorized to use this bot.\n\nPlease contact the bot administrator.`
        );
        return;
      }

      const authenticated = await isGroupAuthenticated(groupId);

      if (!authenticated) {
        startSetupSession(userId, groupId);

        await ctx.reply(
          `👋 **Welcome to TeleGit!**\n\n` +
          `I'm an AI-powered bot that turns your messages into GitHub issues.\n\n` +
          `**To get started:**\n` +
          `I've sent you a private message to configure GitHub integration.\n\n` +
          `**After setup, you can:**\n` +
          `• Mention me (@${ctx.botInfo.username}) in messages\n` +
          `• Use hashtags like #bug, #task, #idea\n` +
          `• I'll automatically create GitHub issues from your messages\n\n` +
          `**Available commands:**\n` +
          `/start - Show this help message\n` +
          `/status - View usage statistics (manager only)\n` +
          `/unlink - Disconnect from GitHub (manager only)`,
          { parse_mode: 'Markdown' }
        );

        try {
          await ctx.telegram.sendMessage(
            userId,
            `🔧 **Let's set up GitHub integration!**\n\n` +
            `Please provide your GitHub repository URL (HTTPS only):\n` +
            `Example: https://github.com/owner/repo-name`,
            { parse_mode: 'Markdown' }
          );
        } catch (error) {
          await ctx.reply(
            `⚠️ I couldn't send you a private message. Please start a chat with me first by clicking @${ctx.botInfo.username} and pressing "Start".`
          );
        }

        return;
      }

      const config = await getGitHubConfig(groupId);

      await ctx.reply(
        `👋 **TeleGit Bot**\n\n` +
        `I'm an AI-powered bot that turns your messages into GitHub issues.\n\n` +
        `**Current Configuration:**\n` +
        `📁 Repository: \`${config.repository}\`\n` +
        `✅ Status: Connected\n\n` +
        `**How to use:**\n` +
        `• Mention me (@${ctx.botInfo.username}) in messages\n` +
        `• Use hashtags like #bug, #task, #idea\n` +
        `• I'll automatically create GitHub issues from your messages\n\n` +
        `**Available commands:**\n` +
        `/start - Show this help message\n` +
        `/status - View usage statistics (manager only)\n` +
        `/unlink - Disconnect from GitHub (manager only)`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error({ err: error, chatId: ctx.chat?.id }, 'Error handling /start command');
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  };
}

/**
 * Create /unlink command handler
 * @returns {Function} Command handler function
 */
export function createUnlinkCommandHandler() {
  return async (ctx) => {
    try {
      if (!isGroupChat(ctx)) {
        await ctx.reply('❌ This command only works in group chats.');
        return;
      }

      const groupId = ctx.chat.id;
      const userId = ctx.from?.id;

      const authenticated = await isGroupAuthenticated(groupId);

      if (!authenticated) {
        await ctx.reply(
          `ℹ️ This group is not linked to a GitHub repository.\n\nUse /start to set up GitHub integration.`
        );
        return;
      }

      const isManager = await isGroupManager(groupId, userId);

      if (!isManager) {
        await ctx.reply(
          `❌ Only the group manager can unlink the GitHub repository.\n\nPlease ask the manager to run this command.`
        );
        return;
      }

      const config = await getGitHubConfig(groupId);

      await ctx.reply(
        `⚠️ **Confirm Unlink**\n\n` +
        `Are you sure you want to disconnect this group from:\n` +
        `📁 \`${config.repository}\`\n\n` +
        `This will:\n` +
        `• Remove the GitHub integration\n` +
        `• Delete stored credentials\n` +
        `• Require setup again to use the bot\n\n` +
        `**This action cannot be undone.**`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Yes, unlink', `unlink_confirm_${groupId}`),
              Markup.button.callback('❌ No, cancel', `unlink_cancel_${groupId}`),
            ],
          ]),
        }
      );
    } catch (error) {
      logger.error({ err: error, chatId: ctx.chat?.id }, 'Error handling /unlink command');
      await ctx.reply('❌ An error occurred. Please try again later.');
    }
  };
}

/**
 * Create unlink callback query handler
 * @returns {Function} Callback query handler function
 */
export function createUnlinkCallbackHandler() {
  return async (ctx) => {
    try {
      const callbackData = ctx.callbackQuery?.data;

      if (!callbackData || !callbackData.startsWith('unlink_')) {
        return;
      }

      const [action, operation, groupIdStr] = callbackData.split('_');
      const groupId = parseInt(groupIdStr, 10);
      const userId = ctx.from?.id;

      if (operation === 'cancel') {
        await ctx.editMessageText('❌ Unlink cancelled.');
        await ctx.answerCbQuery('Cancelled');
        return;
      }

      if (operation === 'confirm') {
        const isManager = await isGroupManager(groupId, userId);

        if (!isManager) {
          await ctx.answerCbQuery('❌ Only the group manager can confirm unlink');
          return;
        }

        const configRepo = new ConfigRepository();
        const deleted = await configRepo.deleteGroupConfig(groupId);

        if (deleted) {
          await ctx.editMessageText(
            `✅ **Successfully unlinked**\n\n` +
            `The GitHub integration has been removed.\n\n` +
            `Use /start to set up a new connection.`,
            { parse_mode: 'Markdown' }
          );
          await ctx.answerCbQuery('Unlinked successfully');
        } else {
          await ctx.editMessageText(
            `❌ Failed to unlink. The group configuration may have already been removed.`
          );
          await ctx.answerCbQuery('Failed to unlink');
        }

        return;
      }
    } catch (error) {
      logger.error({ err: error }, 'Error handling unlink callback');
      await ctx.answerCbQuery('❌ An error occurred');
    }
  };
}

/**
 * Create /status command handler
 * @returns {Function} Command handler function
 */
export function createStatusCommandHandler() {
  return async (ctx) => {
    try {
      if (!isGroupChat(ctx)) {
        await ctx.reply('❌ This command only works in group chats.');
        return;
      }

      const groupId = ctx.chat.id;
      const userId = ctx.from?.id;

      const authenticated = await isGroupAuthenticated(groupId);

      if (!authenticated) {
        await ctx.reply(
          `ℹ️ This group is not linked to a GitHub repository.\n\nUse /start to set up GitHub integration.`
        );
        return;
      }

      const isManager = await isGroupManager(groupId, userId);

      if (!isManager) {
        await ctx.reply(
          `❌ Only the group manager can view status.\n\nPlease ask the manager to run this command.`
        );
        return;
      }

      const statusMessage = await ctx.reply('🔄 Gathering statistics...');

      const config = await getGitHubConfig(groupId);
      const stats = await gatherOperationStats(groupId);

      let dbStatus = '✅ Connected';
      let llmStatus = '✅ Connected';
      let githubStatus = '✅ Connected';

      try {
        await testConnection();
      } catch (error) {
        dbStatus = '❌ Error';
      }

      try {
        createLLMClient();
      } catch (error) {
        llmStatus = '❌ Error';
      }

      try {
        const tools = new GitHubTools();
        await tools.initialize(config.token, config.repository);
      } catch (error) {
        githubStatus = '❌ Error';
      }

      const uptime = formatUptime((Date.now() - startTime) / 1000);

      const message =
        `📊 **Group Status**\n\n` +
        `**GitHub Configuration:**\n` +
        `📁 Repository: \`${config.repository}\`\n` +
        `👤 Manager: ${config.managerUserId}\n` +
        `📅 Created: ${new Date(config.createdAt).toLocaleDateString()}\n\n` +
        `**Operations Summary:**\n` +
        `📈 Total operations: ${stats.total}\n` +
        `✅ Completed: ${stats.byStatus.completed}\n` +
        `⏳ Pending: ${stats.byStatus.pending}\n` +
        `🔄 Processing: ${stats.byStatus.processing}\n` +
        `❌ Failed: ${stats.byStatus.failed}\n` +
        `↩️ Undone: ${stats.byStatus.undone}\n\n` +
        `**Operations by Type:**\n` +
        `${formatOperationsBreakdown(stats.operations)}\n\n` +
        `**Cache Statistics:**\n` +
        `💬 Conversation contexts: ${stats.contextCount}\n` +
        `📝 Pending feedback: ${stats.feedbackCount}\n\n` +
        `**Connection Health:**\n` +
        `🗄️ Database: ${dbStatus}\n` +
        `🤖 LLM API: ${llmStatus}\n` +
        `📁 GitHub MCP: ${githubStatus}\n\n` +
        `**System:**\n` +
        `⏱️ Uptime: ${uptime}`;

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMessage.message_id,
        undefined,
        message,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error({ err: error, chatId: ctx.chat?.id }, 'Error handling /status command');
      await ctx.reply('❌ An error occurred while gathering statistics.');
    }
  };
}
