/**
 * Undo Operation Logic for GitHub Actions
 * Handles reverting GitHub issue operations by fetching from database
 *
 * @module integrations/github/undo
 */

import { createGitHubTools } from './github-tools.js';

/**
 * Operation types that can be undone
 */
export const UndoableOperations = {
  CREATE_ISSUE: 'create_issue',
  UPDATE_ISSUE: 'update_issue',
  CLOSE_ISSUE: 'close_issue',
  REOPEN_ISSUE: 'reopen_issue',
  ADD_LABELS: 'add_labels',
  REMOVE_LABELS: 'remove_labels',
};

/**
 * Operations that cannot be undone
 */
export const NonUndoableOperations = {
  SEARCH_ISSUES: 'search_issues',
};

/**
 * Undo Manager class
 * Manages undo operations for GitHub actions by fetching from database
 */
export class UndoManager {
  constructor(operationsRepository) {
    if (!operationsRepository) {
      throw new Error('OperationsRepository is required for UndoManager');
    }
    this.operationsRepo = operationsRepository;
  }

  /**
   * Check if an operation can be undone
   * @param {string} operationId - Operation ID
   * @returns {Promise<boolean>}
   */
  async canUndo(operationId) {
    const operation = await this.operationsRepo.getOperation(operationId);

    if (!operation) {
      return false;
    }

    // Already undone
    if (operation.undone) {
      return false;
    }

    // Check if operation type is undoable
    return Object.values(UndoableOperations).includes(operation.type);
  }

  /**
   * Undo a GitHub operation
   * @param {string} operationId - Operation ID to undo
   * @param {string} authToken - GitHub PAT for authentication
   * @param {string} [serverUrl] - Optional MCP server URL
   * @returns {Promise<Object>} Undo result
   */
  async undoOperation(operationId, authToken, serverUrl = null) {
    const canUndo = await this.canUndo(operationId);

    if (!canUndo) {
      return {
        success: false,
        error: 'Operation cannot be undone or does not exist',
      };
    }

    const operation = await this.operationsRepo.getOperation(operationId);

    try {
      let result;

      switch (operation.type) {
        case UndoableOperations.CREATE_ISSUE:
          result = await this._undoCreateIssue(operation, authToken, serverUrl);
          break;

        case UndoableOperations.UPDATE_ISSUE:
          result = await this._undoUpdateIssue(operation, authToken, serverUrl);
          break;

        case UndoableOperations.CLOSE_ISSUE:
          result = await this._undoCloseIssue(operation, authToken, serverUrl);
          break;

        case UndoableOperations.REOPEN_ISSUE:
          result = await this._undoReopenIssue(operation, authToken, serverUrl);
          break;

        case UndoableOperations.ADD_LABELS:
          result = await this._undoAddLabels(operation, authToken, serverUrl);
          break;

        case UndoableOperations.REMOVE_LABELS:
          result = await this._undoRemoveLabels(operation, authToken, serverUrl);
          break;

        default:
          return {
            success: false,
            error: `Unknown operation type: ${operation.type}`,
          };
      }

      if (result.success) {
        await this.operationsRepo.markAsUndone(operationId);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to undo operation: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue creation by closing it
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoCreateIssue(operation, authToken, serverUrl) {
    const githubTools = await createGitHubTools(authToken, serverUrl);
    const tools = githubTools.getTools();
    const updateTool = tools.find(t => t.name === 'github_update_issue');

    if (!updateTool) {
      await githubTools.close();
      return {
        success: false,
        error: 'github_update_issue tool not available',
      };
    }

    if (!operation.metadata?.issueNumber || !operation.metadata?.repository) {
      await githubTools.close();
      return {
        success: false,
        error: 'Issue number or repository not found in operation metadata',
      };
    }

    try {
      const body = operation.metadata.previousBody || '';
      const updatedBody = `${body}\n\n---\n\n**Note**: This issue was automatically undone by TeleGit at the user's request.`;

      const result = await updateTool.invoke({
        repository: operation.metadata.repository,
        issue_number: operation.metadata.issueNumber,
        state: 'closed',
        body: updatedBody,
      });

      await githubTools.close();

      return {
        success: true,
        message: `Issue #${operation.metadata.issueNumber} closed (undone)`,
        issueNumber: operation.metadata.issueNumber,
        result,
      };
    } catch (error) {
      await githubTools.close();
      return {
        success: false,
        error: `Failed to close issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue update by reverting to previous state
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoUpdateIssue(operation, authToken, serverUrl) {
    const githubTools = await createGitHubTools(authToken, serverUrl);
    const tools = githubTools.getTools();
    const updateTool = tools.find(t => t.name === 'github_update_issue');

    if (!updateTool) {
      await githubTools.close();
      return {
        success: false,
        error: 'github_update_issue tool not available',
      };
    }

    if (!operation.metadata?.issueNumber || !operation.metadata?.repository) {
      await githubTools.close();
      return {
        success: false,
        error: 'Issue number or repository not found in operation metadata',
      };
    }

    if (!operation.metadata?.previousState) {
      await githubTools.close();
      return {
        success: false,
        error: 'Previous state not available for revert',
      };
    }

    try {
      const result = await updateTool.invoke({
        repository: operation.metadata.repository,
        issue_number: operation.metadata.issueNumber,
        ...operation.metadata.previousState,
      });

      await githubTools.close();

      return {
        success: true,
        message: `Issue #${operation.metadata.issueNumber} reverted to previous state`,
        issueNumber: operation.metadata.issueNumber,
        result,
      };
    } catch (error) {
      await githubTools.close();
      return {
        success: false,
        error: `Failed to revert issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue closure by reopening it
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoCloseIssue(operation, authToken, serverUrl) {
    const githubTools = await createGitHubTools(authToken, serverUrl);
    const tools = githubTools.getTools();
    const updateTool = tools.find(t => t.name === 'github_update_issue');

    if (!updateTool) {
      await githubTools.close();
      return {
        success: false,
        error: 'github_update_issue tool not available',
      };
    }

    if (!operation.metadata?.issueNumber || !operation.metadata?.repository) {
      await githubTools.close();
      return {
        success: false,
        error: 'Issue number or repository not found in operation metadata',
      };
    }

    try {
      const result = await updateTool.invoke({
        repository: operation.metadata.repository,
        issue_number: operation.metadata.issueNumber,
        state: 'open',
      });

      await githubTools.close();

      return {
        success: true,
        message: `Issue #${operation.metadata.issueNumber} reopened`,
        issueNumber: operation.metadata.issueNumber,
        result,
      };
    } catch (error) {
      await githubTools.close();
      return {
        success: false,
        error: `Failed to reopen issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue reopening by closing it again
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoReopenIssue(operation, authToken, serverUrl) {
    const githubTools = await createGitHubTools(authToken, serverUrl);
    const tools = githubTools.getTools();
    const updateTool = tools.find(t => t.name === 'github_update_issue');

    if (!updateTool) {
      await githubTools.close();
      return {
        success: false,
        error: 'github_update_issue tool not available',
      };
    }

    if (!operation.metadata?.issueNumber || !operation.metadata?.repository) {
      await githubTools.close();
      return {
        success: false,
        error: 'Issue number or repository not found in operation metadata',
      };
    }

    try {
      const result = await updateTool.invoke({
        repository: operation.metadata.repository,
        issue_number: operation.metadata.issueNumber,
        state: 'closed',
      });

      await githubTools.close();

      return {
        success: true,
        message: `Issue #${operation.metadata.issueNumber} closed`,
        issueNumber: operation.metadata.issueNumber,
        result,
      };
    } catch (error) {
      await githubTools.close();
      return {
        success: false,
        error: `Failed to close issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo label addition by restoring previous labels
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoAddLabels(operation, authToken, serverUrl) {
    const githubTools = await createGitHubTools(authToken, serverUrl);
    const tools = githubTools.getTools();
    const updateTool = tools.find(t => t.name === 'github_update_issue');

    if (!updateTool) {
      await githubTools.close();
      return {
        success: false,
        error: 'github_update_issue tool not available',
      };
    }

    if (!operation.metadata?.issueNumber || !operation.metadata?.repository) {
      await githubTools.close();
      return {
        success: false,
        error: 'Issue number or repository not found in operation metadata',
      };
    }

    if (!operation.metadata?.previousState?.labels) {
      await githubTools.close();
      return {
        success: false,
        error: 'Previous labels not found in operation metadata',
      };
    }

    try {
      const result = await updateTool.invoke({
        repository: operation.metadata.repository,
        issue_number: operation.metadata.issueNumber,
        labels: operation.metadata.previousState.labels,
      });

      await githubTools.close();

      return {
        success: true,
        message: `Labels restored for issue #${operation.metadata.issueNumber}`,
        issueNumber: operation.metadata.issueNumber,
        result,
      };
    } catch (error) {
      await githubTools.close();
      return {
        success: false,
        error: `Failed to restore labels: ${error.message}`,
      };
    }
  }

  /**
   * Undo label removal by adding them back
   * @param {Object} operation - Operation details from database
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoRemoveLabels(operation, authToken, serverUrl) {
    return this._undoAddLabels(operation, authToken, serverUrl);
  }
}

/**
 * Create an undo manager instance
 * @param {Object} operationsRepository - Operations repository instance
 * @returns {UndoManager} New undo manager instance
 */
export function createUndoManager(operationsRepository) {
  return new UndoManager(operationsRepository);
}

/**
 * Convenience function to undo an operation
 * @param {string} operationId - Operation ID
 * @param {string} authToken - GitHub PAT
 * @param {Object} operationsRepository - Operations repository instance
 * @param {string} [serverUrl] - MCP server URL
 * @returns {Promise<Object>} Undo result
 */
export async function undoOperation(operationId, authToken, operationsRepository, serverUrl = null) {
  const manager = createUndoManager(operationsRepository);
  return await manager.undoOperation(operationId, authToken, serverUrl);
}

/**
 * Check if an operation can be undone
 * @param {string} operationId - Operation ID
 * @param {Object} operationsRepository - Operations repository instance
 * @returns {Promise<boolean>}
 */
export async function canUndoOperation(operationId, operationsRepository) {
  const manager = createUndoManager(operationsRepository);
  return await manager.canUndo(operationId);
}
