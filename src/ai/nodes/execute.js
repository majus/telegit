/**
 * Execute Node
 * Executes GitHub operations via MCP tools
 *
 * Task 4.3.7: Implement Execute Node
 */

import { createGitHubTools } from '../../integrations/github/github-tools.js';
import { GitHubOperationType, WorkflowStatus } from '../state-schema.js';
import logger from '../../utils/logger.js';

/**
 * Execute GitHub operation via MCP tools
 *
 * @param {Object} state - Current workflow state
 * @returns {Promise<Object>} Updated state with execution result
 */
export async function executeNode(state) {
  try {
    const { githubOperation, groupConfig } = state;

    if (!githubOperation || githubOperation.type === GitHubOperationType.NONE) {
      logger.debug('No GitHub operation to execute');
      return {
        ...state,
        result: {
          success: false,
          message: 'No GitHub operation to execute',
        },
        status: WorkflowStatus.COMPLETED,
      };
    }

    if (!groupConfig || !groupConfig.githubToken) {
      throw new Error('Missing GitHub token in group configuration');
    }

    // Initialize GitHub tools with user's token
    const tools = await createGitHubTools(
      groupConfig.githubToken,
      groupConfig.githubRepo
    );

    let result = null;

    try {
      switch (githubOperation.type) {
        case GitHubOperationType.CREATE:
          result = await executeCreate(tools, githubOperation);
          break;

        case GitHubOperationType.UPDATE:
          result = await executeUpdate(tools, githubOperation);
          break;

        case GitHubOperationType.SEARCH:
          result = await executeSearch(tools, githubOperation);
          break;

        default:
          throw new Error(`Unknown operation type: ${githubOperation.type}`);
      }

      return {
        ...state,
        result,
        status: WorkflowStatus.EXECUTING,
        timestamps: {
          ...state.timestamps,
          executedAt: Date.now(),
        },
      };
    } finally {
      // Clean up tools
      await tools.close();
    }
  } catch (error) {
    logger.error({
      err: error,
      operationType: state.githubOperation?.type,
    }, 'Error executing GitHub operation');

    return {
      ...state,
      error: {
        message: error.message,
        code: 'GITHUB_EXECUTION_ERROR',
        details: error.stack,
      },
      result: {
        success: false,
        error: error.message,
      },
      status: WorkflowStatus.ERROR,
    };
  }
}

/**
 * Execute create issue operation
 *
 * @param {Object} tools - GitHub tools instance
 * @param {Object} operation - GitHub operation data
 * @returns {Promise<Object>} Execution result
 */
async function executeCreate(tools, operation) {
  const { repository, data } = operation;
  const { title, body, labels, assignees } = data;

  // Split repository into owner and repo
  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repository}. Expected format: owner/repo`);
  }

  logger.debug({
    owner,
    repo,
    title,
    labels,
    assignees: assignees?.length || 0,
  }, 'Creating GitHub issue');

  const createTool = tools.getTool('issue_write');

  if (!createTool) {
    throw new Error('issue_write tool not available');
  }

  // Invoke the tool with correct schema
  const response = await createTool.invoke({
    method: 'create',
    owner,
    repo,
    title,
    body,
    labels: labels || [],
    assignees: assignees || [],
  });

  // Parse response (MCP tools typically return JSON strings)
  const issueData = typeof response === 'string' ? JSON.parse(response) : response;

  logger.info({
    issueUrl: issueData.html_url,
    issueNumber: issueData.number,
  }, 'GitHub issue created successfully');

  return {
    success: true,
    issueUrl: issueData.html_url,
    issueNumber: issueData.number,
    data: issueData,
  };
}

/**
 * Execute update issue operation
 *
 * @param {Object} tools - GitHub tools instance
 * @param {Object} operation - GitHub operation data
 * @returns {Promise<Object>} Execution result
 */
async function executeUpdate(tools, operation) {
  const { repository, data } = operation;
  const { issueNumber, title, body, labels, assignees, state } = data;

  // Split repository into owner and repo
  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repository}. Expected format: owner/repo`);
  }

  logger.debug({
    owner,
    repo,
    issueNumber,
    title,
  }, 'Updating GitHub issue');

  const updateTool = tools.getTool('issue_write');

  if (!updateTool) {
    throw new Error('issue_write tool not available');
  }

  const response = await updateTool.invoke({
    method: 'update',
    owner,
    repo,
    issue_number: issueNumber,
    title,
    body,
    labels: labels || [],
    assignees: assignees || [],
    state,
  });

  const issueData = typeof response === 'string' ? JSON.parse(response) : response;

  logger.info({
    issueUrl: issueData.html_url,
    issueNumber: issueData.number,
  }, 'GitHub issue updated successfully');

  return {
    success: true,
    issueUrl: issueData.html_url,
    issueNumber: issueData.number,
    data: issueData,
  };
}

/**
 * Execute search issues operation
 *
 * @param {Object} tools - GitHub tools instance
 * @param {Object} operation - GitHub operation data
 * @returns {Promise<Object>} Execution result
 */
async function executeSearch(tools, operation) {
  const { repository, data } = operation;
  const { query, labels, state, limit } = data;

  logger.debug({
    repository,
    query,
    labels,
  }, 'Searching GitHub issues');

  const searchTool = tools.getTool('search_issues');

  if (!searchTool) {
    throw new Error('search_issues tool not available');
  }

  const response = await searchTool.invoke({
    repository,
    query,
    labels: labels || [],
    state: state || 'open',
    limit: limit || 10,
  });

  const searchResults = typeof response === 'string' ? JSON.parse(response) : response;

  logger.info({
    resultsCount: searchResults.length || 0,
  }, 'GitHub issues search completed');

  return {
    success: true,
    results: searchResults,
    count: searchResults.length || 0,
  };
}
