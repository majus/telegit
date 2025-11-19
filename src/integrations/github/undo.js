/**
 * Undo Operation Logic for GitHub Actions
 * Handles reverting GitHub issue operations
 *
 * @module integrations/github/undo
 */

import { createGitHubTools } from './tools.js';

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
 * Manages undo operations for GitHub actions
 */
export class UndoManager {
  constructor() {
    this.operationHistory = new Map();
  }

  /**
   * Record an operation for potential undo
   * @param {string} operationId - Unique operation ID
   * @param {Object} operation - Operation details
   * @param {string} operation.type - Operation type (from UndoableOperations)
   * @param {string} operation.repository - Repository (owner/repo)
   * @param {number} operation.issueNumber - Issue number (if applicable)
   * @param {Object} [operation.previousState] - Previous state for revert
   * @param {Object} [operation.metadata] - Additional metadata
   */
  recordOperation(operationId, operation) {
    if (!operationId || !operation) {
      throw new Error('operationId and operation are required');
    }

    if (!operation.type || !operation.repository) {
      throw new Error('operation.type and operation.repository are required');
    }

    this.operationHistory.set(operationId, {
      ...operation,
      timestamp: Date.now(),
      undone: false,
    });
  }

  /**
   * Get operation details by ID
   * @param {string} operationId - Operation ID
   * @returns {Object|null} Operation details or null
   */
  getOperation(operationId) {
    return this.operationHistory.get(operationId) || null;
  }

  /**
   * Check if an operation can be undone
   * @param {string} operationId - Operation ID
   * @returns {boolean}
   */
  canUndo(operationId) {
    const operation = this.getOperation(operationId);

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
   * Mark operation as undone
   * @param {string} operationId - Operation ID
   */
  markAsUndone(operationId) {
    const operation = this.getOperation(operationId);
    if (operation) {
      operation.undone = true;
      operation.undoneAt = Date.now();
    }
  }

  /**
   * Undo a GitHub operation
   * @param {string} operationId - Operation ID to undo
   * @param {string} authToken - GitHub PAT for authentication
   * @param {string} [serverUrl] - Optional MCP server URL
   * @returns {Promise<Object>} Undo result
   */
  async undoOperation(operationId, authToken, serverUrl = null) {
    if (!this.canUndo(operationId)) {
      return {
        success: false,
        error: 'Operation cannot be undone or does not exist',
      };
    }

    const operation = this.getOperation(operationId);

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
        this.markAsUndone(operationId);
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
   * Undo issue creation by closing it with a comment
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoCreateIssue(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber) {
      return {
        success: false,
        error: 'Issue number not found in operation metadata',
      };
    }

    try {
      // Close the issue with explanatory comment in the body
      const result = await tools.updateIssue(
        operation.repository,
        operation.issueNumber,
        {
          state: 'closed',
          body: `${operation.previousState?.body || ''}\n\n---\n\n**Note**: This issue was automatically undone by TeleGit at the user's request.`,
        }
      );

      return {
        success: true,
        message: `Issue #${operation.issueNumber} closed (undone)`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to close issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue update by reverting to previous state
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoUpdateIssue(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber) {
      return {
        success: false,
        error: 'Issue number not found in operation metadata',
      };
    }

    if (!operation.previousState) {
      return {
        success: false,
        error: 'Previous state not available for revert',
      };
    }

    try {
      // Revert to previous state
      const result = await tools.updateIssue(
        operation.repository,
        operation.issueNumber,
        operation.previousState
      );

      return {
        success: true,
        message: `Issue #${operation.issueNumber} reverted to previous state`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to revert issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue closure by reopening it
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoCloseIssue(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber) {
      return {
        success: false,
        error: 'Issue number not found in operation metadata',
      };
    }

    try {
      const result = await tools.reopenIssue(operation.repository, operation.issueNumber);

      return {
        success: true,
        message: `Issue #${operation.issueNumber} reopened`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to reopen issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo issue reopening by closing it again
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoReopenIssue(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber) {
      return {
        success: false,
        error: 'Issue number not found in operation metadata',
      };
    }

    try {
      const result = await tools.closeIssue(operation.repository, operation.issueNumber);

      return {
        success: true,
        message: `Issue #${operation.issueNumber} closed`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to close issue: ${error.message}`,
      };
    }
  }

  /**
   * Undo label addition by removing them
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoAddLabels(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber || !operation.previousState?.labels) {
      return {
        success: false,
        error: 'Issue number or previous labels not found',
      };
    }

    try {
      // Restore previous labels
      const result = await tools.updateIssue(
        operation.repository,
        operation.issueNumber,
        {
          labels: operation.previousState.labels,
        }
      );

      return {
        success: true,
        message: `Labels restored for issue #${operation.issueNumber}`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore labels: ${error.message}`,
      };
    }
  }

  /**
   * Undo label removal by adding them back
   * @param {Object} operation - Operation details
   * @param {string} authToken - GitHub PAT
   * @param {string} [serverUrl] - MCP server URL
   * @returns {Promise<Object>} Undo result
   * @private
   */
  async _undoRemoveLabels(operation, authToken, serverUrl) {
    const tools = await createGitHubTools(serverUrl, authToken);

    if (!operation.issueNumber || !operation.previousState?.labels) {
      return {
        success: false,
        error: 'Issue number or previous labels not found',
      };
    }

    try {
      // Restore previous labels
      const result = await tools.updateIssue(
        operation.repository,
        operation.issueNumber,
        {
          labels: operation.previousState.labels,
        }
      );

      return {
        success: true,
        message: `Labels restored for issue #${operation.issueNumber}`,
        issueNumber: operation.issueNumber,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to restore labels: ${error.message}`,
      };
    }
  }

  /**
   * Clear operation history
   * @param {number} [olderThan] - Optional timestamp - clear operations older than this
   */
  clearHistory(olderThan = null) {
    if (olderThan) {
      for (const [id, operation] of this.operationHistory.entries()) {
        if (operation.timestamp < olderThan) {
          this.operationHistory.delete(id);
        }
      }
    } else {
      this.operationHistory.clear();
    }
  }

  /**
   * Get history size
   * @returns {number}
   */
  getHistorySize() {
    return this.operationHistory.size;
  }

  /**
   * Get all operations (optionally filtered)
   * @param {Object} [filter] - Optional filter criteria
   * @param {string} [filter.type] - Filter by operation type
   * @param {boolean} [filter.undone] - Filter by undone status
   * @returns {Array} Array of operations
   */
  getOperations(filter = {}) {
    const operations = Array.from(this.operationHistory.entries()).map(
      ([id, operation]) => ({
        id,
        ...operation,
      })
    );

    if (Object.keys(filter).length === 0) {
      return operations;
    }

    return operations.filter((op) => {
      if (filter.type && op.type !== filter.type) {
        return false;
      }

      if (filter.undone !== undefined && op.undone !== filter.undone) {
        return false;
      }

      return true;
    });
  }
}

/**
 * Singleton undo manager instance
 */
let sharedUndoManagerInstance = null;

/**
 * Get or create shared undo manager instance
 * @returns {UndoManager} Shared undo manager instance
 */
export function getSharedUndoManager() {
  if (!sharedUndoManagerInstance) {
    sharedUndoManagerInstance = new UndoManager();
  }

  return sharedUndoManagerInstance;
}

/**
 * Create a new undo manager instance
 * @returns {UndoManager} New undo manager instance
 */
export function createUndoManager() {
  return new UndoManager();
}

/**
 * Convenience function to undo an operation
 * @param {string} operationId - Operation ID
 * @param {string} authToken - GitHub PAT
 * @param {string} [serverUrl] - MCP server URL
 * @returns {Promise<Object>} Undo result
 */
export async function undoOperation(operationId, authToken, serverUrl = null) {
  const manager = getSharedUndoManager();
  return await manager.undoOperation(operationId, authToken, serverUrl);
}

/**
 * Record an operation for undo
 * @param {string} operationId - Operation ID
 * @param {Object} operation - Operation details
 */
export function recordOperation(operationId, operation) {
  const manager = getSharedUndoManager();
  manager.recordOperation(operationId, operation);
}

/**
 * Check if an operation can be undone
 * @param {string} operationId - Operation ID
 * @returns {boolean}
 */
export function canUndoOperation(operationId) {
  const manager = getSharedUndoManager();
  return manager.canUndo(operationId);
}
