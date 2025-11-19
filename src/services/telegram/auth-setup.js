/**
 * GitHub PAT setup workflow
 * DM-based conversation flow for configuring GitHub authentication
 */

import { ConfigRepository } from '../../database/repositories/config.js';
import logger from '../../utils/logger.js';

/**
 * Configuration constants
 */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * In-memory storage for setup sessions
 * In production, this should be persisted to database
 * Key: userId, Value: { step, data, groupId, timestamp }
 */
const setupSessions = new Map();

/**
 * Setup workflow steps
 */
const SetupSteps = {
  AWAITING_REPO: 'awaiting_repo',
  AWAITING_PAT: 'awaiting_pat',
  COMPLETED: 'completed',
};

/**
 * Start a new setup session for a user
 * @param {number} userId - Telegram user ID
 * @param {number} groupId - Telegram group ID to configure
 * @returns {Object} Session info
 */
export function startSetupSession(userId, groupId) {
  const session = {
    step: SetupSteps.AWAITING_REPO,
    data: {},
    groupId,
    timestamp: Date.now(),
  };

  setupSessions.set(userId, session);

  logger.debug({ userId, groupId }, 'Setup session started');
  return session;
}

/**
 * Get active setup session for a user
 * @param {number} userId - Telegram user ID
 * @returns {Object|null} Session or null if expired/not found
 */
export function getSetupSession(userId) {
  const session = setupSessions.get(userId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (Date.now() - session.timestamp > SESSION_TIMEOUT_MS) {
    setupSessions.delete(userId);
    return null;
  }

  return session;
}

/**
 * Update setup session
 * @param {number} userId - Telegram user ID
 * @param {Object} updates - Updates to apply
 */
export function updateSetupSession(userId, updates) {
  const session = getSetupSession(userId);

  if (!session) {
    throw new Error('No active setup session found');
  }

  Object.assign(session, updates, { timestamp: Date.now() });
  setupSessions.set(userId, session);
}

/**
 * End setup session
 * @param {number} userId - Telegram user ID
 */
export function endSetupSession(userId) {
  setupSessions.delete(userId);
  logger.debug({ userId }, 'Setup session ended');
}

/**
 * Handle repository URL input
 * @param {Object} ctx - Telegraf context
 * @param {string} repoUrl - Repository URL
 * @returns {Promise<Object>} Result with success and message
 */
export async function handleRepoInput(ctx, repoUrl) {
  const userId = ctx.from.id;
  const session = getSetupSession(userId);

  if (!session) {
    return {
      success: false,
      message: '❌ No active setup session. Please start the setup process again.',
    };
  }

  if (session.step !== SetupSteps.AWAITING_REPO) {
    return {
      success: false,
      message: '❌ Unexpected input. Please follow the setup steps in order.',
    };
  }

  // Validate repository URL format (HTTPS only for security)
  const repoPattern = /^https:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/?$/;
  const match = repoUrl.trim().match(repoPattern);

  if (!match) {
    return {
      success: false,
      message: `❌ Invalid repository URL format.

Please provide a valid GitHub repository URL (HTTPS only) like:
https://github.com/owner/repo-name

Try again:`,
    };
  }

  const [, owner, repo] = match;
  const githubRepo = `${owner}/${repo}`;

  // Store repository info
  updateSetupSession(userId, {
    step: SetupSteps.AWAITING_PAT,
    data: { ...session.data, githubRepo, repoUrl },
  });

  return {
    success: true,
    message: `✅ Repository set: \`${githubRepo}\`

Now I need your GitHub Personal Access Token (PAT).

🔐 **How to create a PAT:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "TeleGit Bot")
4. Select scopes: \`repo\` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token (it starts with \`ghp_\`)

📤 **Send me your PAT:**
Paste the token here (it will be encrypted and stored securely)`,
    parseMode: 'Markdown',
  };
}

/**
 * Handle PAT input
 * @param {Object} ctx - Telegraf context
 * @param {string} pat - GitHub Personal Access Token
 * @param {Function} validatePatFn - Function to validate PAT
 * @returns {Promise<Object>} Result with success and message
 */
export async function handlePATInput(ctx, pat, validatePatFn) {
  const userId = ctx.from.id;
  const session = getSetupSession(userId);

  if (!session) {
    return {
      success: false,
      message: '❌ No active setup session. Please start the setup process again.',
    };
  }

  if (session.step !== SetupSteps.AWAITING_PAT) {
    return {
      success: false,
      message: '❌ Unexpected input. Please provide your repository URL first.',
    };
  }

  const patValue = pat.trim();

  // Basic format validation
  if (!patValue.startsWith('ghp_') && !patValue.startsWith('github_pat_')) {
    return {
      success: false,
      message: `❌ Invalid PAT format.

GitHub Personal Access Tokens should start with \`ghp_\` or \`github_pat_\`.

Please check your token and try again:`,
      parseMode: 'Markdown',
    };
  }

  // CRITICAL: Delete the message containing the PAT for security
  try {
    await ctx.deleteMessage();
  } catch (error) {
    // PAT deletion failure is a CRITICAL security issue
    logger.error({ err: error }, 'SECURITY: Failed to delete PAT message');
    return {
      success: false,
      message: `❌ CRITICAL SECURITY ERROR: Could not delete your PAT message from chat history.

For your security, please:
1. Revoke the PAT you just sent at: https://github.com/settings/tokens
2. Delete the message manually if possible
3. Try the setup process again

Your PAT is currently visible in chat history - please revoke it immediately.`,
    };
  }

  // Validate PAT with GitHub API if validator provided
  if (validatePatFn) {
    try {
      const validation = await validatePatFn(patValue, session.data.githubRepo);

      if (!validation.valid) {
        return {
          success: false,
          message: `❌ PAT validation failed: ${validation.error}

Please check:
- The token is correct
- It has \`repo\` scope
- It has access to \`${session.data.githubRepo}\`

Try again with a valid token:`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to validate PAT: ${error.message}

Please try again:`,
      };
    }
  }

  // Store configuration in database
  try {
    const configRepo = new ConfigRepository();
    await configRepo.setGroupConfig(session.groupId, {
      githubRepo: session.data.githubRepo,
      githubToken: patValue,
      managerUserId: userId,
    });

    // End the session
    endSetupSession(userId);

    return {
      success: true,
      message: `✅ **Setup Complete!**

Your group is now connected to:
📁 Repository: \`${session.data.githubRepo}\`

You can now use the bot in your group chat by:
- Mentioning me (@${ctx.botInfo.username})
- Using hashtags (#bug, #task, #idea, etc.)

I'll automatically create and manage GitHub issues from your messages! 🎉`,
      parseMode: 'Markdown',
      groupId: session.groupId,
    };
  } catch (error) {
    logger.error({ err: error }, 'Failed to save configuration');

    return {
      success: false,
      message: `❌ Failed to save configuration: ${error.message}

Please try the setup process again.`,
    };
  }
}

/**
 * Handle DM setup flow
 * Main entry point for processing DM messages during setup
 * @param {Object} ctx - Telegraf context
 * @param {Function} validatePatFn - Function to validate PAT
 * @returns {Promise<void>}
 */
export async function handleSetupMessage(ctx, validatePatFn = null) {
  const userId = ctx.from.id;
  const messageText = ctx.message.text?.trim();

  if (!messageText) {
    return;
  }

  const session = getSetupSession(userId);

  if (!session) {
    // No active session
    await ctx.reply(
      `👋 Hi! I'm TeleGit Bot.

To set up GitHub integration for a group:
1. Add me to your Telegram group
2. Try to use me there (mention me or use a hashtag)
3. I'll guide you through the setup process

If you were in the middle of setup, please start again from your group chat.`
    );
    return;
  }

  // Process based on current step
  let result;

  if (session.step === SetupSteps.AWAITING_REPO) {
    result = await handleRepoInput(ctx, messageText);
  } else if (session.step === SetupSteps.AWAITING_PAT) {
    result = await handlePATInput(ctx, messageText, validatePatFn);
  } else {
    result = {
      success: false,
      message: '❌ Unknown setup step. Please start over.',
    };
    endSetupSession(userId);
  }

  // Send response
  await ctx.reply(result.message, {
    parse_mode: result.parseMode || null,
  });

  // If setup completed successfully, notify the group
  if (result.success && result.groupId && session.step === SetupSteps.AWAITING_PAT) {
    try {
      await ctx.telegram.sendMessage(
        result.groupId,
        `✅ GitHub integration is now set up!

I'm ready to help you manage issues in \`${session.data.githubRepo}\`.

Just mention me or use hashtags to get started! 🚀`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to notify group of completed setup');
    }
  }
}

/**
 * Clean up expired sessions (should be run periodically)
 * @returns {number} Number of sessions cleaned up
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, session] of setupSessions.entries()) {
    if (now - session.timestamp > SESSION_TIMEOUT_MS) {
      setupSessions.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info({ count: cleaned }, 'Cleaned up expired setup sessions');
  }

  return cleaned;
}
