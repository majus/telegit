/**
 * Format Node
 * Formats issue data for GitHub operations
 *
 * Task 4.3.6: Implement Format Node
 */

import { IntentType, GitHubOperationType } from '../state-schema.js';
import { sanitizeTitle, sanitizeMessageBody } from '../../utils/sanitize.js';
import logger from '../../utils/logger.js';

/**
 * Formats issue title
 *
 * @param {Object} intent - Classified intent
 * @returns {string} Formatted title
 */
function formatTitle(intent) {
  const title = intent.entities?.title || 'Untitled Issue';
  return sanitizeTitle(title);
}

/**
 * Formats issue body with metadata
 *
 * @param {Object} intent - Classified intent
 * @param {Object} telegramMessage - Original Telegram message
 * @returns {string} Formatted body
 */
function formatBody(intent, telegramMessage) {
  const description = intent.entities?.description || intent.entities?.title || '';
  const sanitizedDescription = sanitizeMessageBody(description);

  // Build metadata footer
  const username = telegramMessage?.from?.username || 'Unknown';
  const chatId = telegramMessage?.chat?.id || 'Unknown';
  const messageId = telegramMessage?.message_id || 'Unknown';

  const metadata = `

---

*Created by TeleGit from Telegram*
- User: @${username}
- Chat ID: ${chatId}
- Message ID: ${messageId}
- Confidence: ${Math.round(intent.confidence * 100)}%`;

  return sanitizedDescription + metadata;
}

/**
 * Formats labels from intent and hashtags
 *
 * @param {Object} intent - Classified intent
 * @returns {string[]} Array of labels
 */
function formatLabels(intent) {
  const labels = [...(intent.entities?.labels || [])];

  // Add intent-based label
  switch (intent.intent) {
    case IntentType.CREATE_BUG:
      if (!labels.includes('bug')) labels.push('bug');
      break;
    case IntentType.CREATE_TASK:
      if (!labels.includes('task')) labels.push('task');
      break;
    case IntentType.CREATE_IDEA:
      if (!labels.includes('enhancement')) labels.push('enhancement');
      if (!labels.includes('idea')) labels.push('idea');
      break;
  }

  // Add TeleGit label
  if (!labels.includes('telegit')) labels.push('telegit');

  // Remove duplicates and filter invalid labels
  return [...new Set(labels)]
    .filter(label => label && typeof label === 'string')
    .map(label => label.toLowerCase())
    .slice(0, 10); // GitHub max 10 labels per issue
}

/**
 * Formats assignees
 *
 * @param {Object} intent - Classified intent
 * @returns {string[]} Array of assignees
 */
function formatAssignees(intent) {
  const assignees = intent.entities?.assignees || [];

  // Remove duplicates and filter invalid assignees
  return [...new Set(assignees)]
    .filter(assignee => assignee && typeof assignee === 'string')
    .slice(0, 10); // Limit to 10 assignees
}

/**
 * Determines the GitHub operation type from intent
 *
 * @param {string} intentType - Intent type
 * @returns {string} GitHub operation type
 */
function getOperationType(intentType) {
  switch (intentType) {
    case IntentType.CREATE_BUG:
    case IntentType.CREATE_TASK:
    case IntentType.CREATE_IDEA:
      return GitHubOperationType.CREATE;

    case IntentType.UPDATE_ISSUE:
      return GitHubOperationType.UPDATE;

    case IntentType.SEARCH_ISSUES:
      return GitHubOperationType.SEARCH;

    default:
      return GitHubOperationType.NONE;
  }
}

/**
 * Format node - prepares GitHub issue data
 *
 * @param {Object} state - Current workflow state
 * @returns {Object} Updated state with formatted GitHub operation
 */
export async function formatNode(state) {
  try {
    const { intent, telegramMessage, groupConfig } = state;

    if (!intent) {
      throw new Error('No intent found in state');
    }

    if (!groupConfig || !groupConfig.repository) {
      throw new Error('No group configuration or repository found');
    }

    const operationType = getOperationType(intent.intent);

    // Format the GitHub operation based on operation type
    const githubOperation = {
      type: operationType,
      repository: groupConfig.repository,
      data: {},
    };

    switch (operationType) {
      case GitHubOperationType.CREATE:
        githubOperation.data = {
          title: formatTitle(intent),
          body: formatBody(intent, telegramMessage),
          labels: formatLabels(intent),
          assignees: formatAssignees(intent),
        };
        break;

      case GitHubOperationType.UPDATE:
        githubOperation.data = {
          issueNumber: intent.entities?.issueNumber,
          title: intent.entities?.title ? formatTitle(intent) : undefined,
          body: intent.entities?.description ? formatBody(intent, telegramMessage) : undefined,
          labels: intent.entities?.labels ? formatLabels(intent) : undefined,
          assignees: intent.entities?.assignees ? formatAssignees(intent) : undefined,
        };
        break;

      case GitHubOperationType.SEARCH:
        githubOperation.data = {
          query: intent.entities?.searchQuery || '',
          labels: intent.entities?.labels || [],
        };
        break;

      default:
        // No operation needed
        githubOperation.data = {};
    }

    return {
      ...state,
      githubOperation,
    };
  } catch (error) {
    logger.error({
      err: error,
      chatId: state.telegramMessage?.chat?.id,
      messageId: state.telegramMessage?.message_id,
      intent: state.intent?.intent,
    }, 'Error in format node');

    return {
      ...state,
      error: {
        message: `Issue formatting failed: ${error.message}`,
        code: 'FORMATTING_ERROR',
        details: error.stack,
      },
    };
  }
}
