/**
 * LangGraph State Schema Definition
 * Defines the state structure for the AI workflow graph
 *
 * Task 4.1.2: Define LangGraph State Schema
 */

import { Annotation } from '@langchain/langgraph';

/**
 * Intent types that can be classified from Telegram messages
 * @enum {string}
 */
export const IntentType = {
  CREATE_BUG: 'create_bug',
  CREATE_TASK: 'create_task',
  CREATE_IDEA: 'create_idea',
  UPDATE_ISSUE: 'update_issue',
  SEARCH_ISSUES: 'search_issues',
  UNKNOWN: 'unknown',
};

/**
 * GitHub operation types
 * @enum {string}
 */
export const GitHubOperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  SEARCH: 'search',
  NONE: 'none',
};

/**
 * Workflow status states
 * @enum {string}
 */
export const WorkflowStatus = {
  ANALYZING: 'analyzing',
  PROCESSING: 'processing',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  ERROR: 'error',
};

/**
 * LangGraph State Annotation
 * Defines all state channels for the workflow
 *
 * State channels are the data that flows through the workflow graph.
 * Each node can read from and write to these channels.
 */
export const WorkflowState = Annotation.Root({
  /**
   * Original Telegram message object
   * Contains message text, user info, chat info, attachments, etc.
   * @type {Object}
   */
  telegramMessage: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Classified intent and extracted entities
   * Set by the analyze node
   * @type {Object|null}
   * @property {string} intent - Intent type (see IntentType enum)
   * @property {number} confidence - Confidence score (0-1)
   * @property {Object} entities - Extracted entities
   * @property {string} entities.title - Issue title
   * @property {string} entities.description - Issue description
   * @property {string[]} entities.labels - Issue labels
   * @property {string[]} entities.assignees - Issue assignees
   * @property {string} entities.issueNumber - Issue number (for updates)
   */
  intent: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Conversation context from thread (if message is a reply)
   * Array of previous messages in the thread
   * @type {Object[]|null}
   */
  conversationContext: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * GitHub operation to execute
   * Prepared by create/update/search nodes
   * @type {Object|null}
   * @property {string} type - Operation type (see GitHubOperationType)
   * @property {string} repository - GitHub repository (owner/repo)
   * @property {Object} data - Operation-specific data
   */
  githubOperation: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Result from GitHub operation execution
   * @type {Object|null}
   * @property {boolean} success - Whether operation succeeded
   * @property {string} issueUrl - URL of created/updated issue
   * @property {number} issueNumber - GitHub issue number
   * @property {Object} data - Additional result data
   */
  result: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Error information if workflow fails
   * @type {Object|null}
   * @property {string} message - Error message
   * @property {string} code - Error code
   * @property {Object} details - Additional error details
   */
  error: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Current workflow status
   * @type {string}
   */
  status: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => WorkflowStatus.ANALYZING,
  }),

  /**
   * Processing timestamps for performance tracking
   * @type {Object}
   * @property {number} startedAt - Workflow start timestamp
   * @property {number} analyzedAt - Intent analysis completion timestamp
   * @property {number} executedAt - GitHub operation execution timestamp
   * @property {number} completedAt - Workflow completion timestamp
   */
  timestamps: Annotation({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({
      startedAt: Date.now(),
      analyzedAt: null,
      executedAt: null,
      completedAt: null,
    }),
  }),

  /**
   * Group configuration (GitHub PAT, repository, etc.)
   * Retrieved from database based on Telegram group ID
   * @type {Object|null}
   * @property {string} repository - GitHub repository (owner/repo)
   * @property {string} githubToken - Decrypted GitHub PAT
   */
  groupConfig: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * Operation ID from database
   * Used to track and store the operation
   * @type {number|null}
   */
  operationId: Annotation({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});

/**
 * Creates an initial state object for a new workflow
 *
 * @param {Object} telegramMessage - Telegram message object
 * @param {Object} groupConfig - Group configuration
 * @returns {Object} Initial state
 */
export function createInitialState(telegramMessage, groupConfig) {
  return {
    telegramMessage,
    groupConfig,
    intent: null,
    conversationContext: null,
    githubOperation: null,
    result: null,
    error: null,
    status: WorkflowStatus.ANALYZING,
    timestamps: {
      startedAt: Date.now(),
      analyzedAt: null,
      executedAt: null,
      completedAt: null,
    },
    operationId: null,
  };
}

/**
 * Validates that a state object has all required fields
 *
 * @param {Object} state - State object to validate
 * @returns {boolean} True if valid
 * @throws {Error} If state is invalid
 */
export function validateState(state) {
  if (!state.telegramMessage) {
    throw new Error('State must have a telegramMessage');
  }

  if (!state.timestamps || !state.timestamps.startedAt) {
    throw new Error('State must have timestamps with startedAt');
  }

  return true;
}
