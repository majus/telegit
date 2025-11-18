/**
 * GitHub Tool Functions
 * Wrapper functions for GitHub MCP tools providing a simplified interface
 *
 * @module integrations/github/tools
 */

import { createGitHubMCPAdapter } from './mcp-adapter.js';

/**
 * GitHub Tools class
 * Provides high-level functions for GitHub issue operations
 */
export class GitHubTools {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Create a new GitHub issue
   * @param {string} repository - Repository in format "owner/repo"
   * @param {string} title - Issue title
   * @param {string} body - Issue body (supports markdown)
   * @param {string[]} [labels] - Optional array of label names
   * @param {string[]} [assignees] - Optional array of GitHub usernames
   * @returns {Promise<Object>} Created issue data
   * @throws {Error} If issue creation fails
   */
  async createIssue(repository, title, body, labels = [], assignees = []) {
    if (!repository || !title || !body) {
      throw new Error('repository, title, and body are required to create an issue');
    }

    // Validate repository format
    if (!repository.includes('/')) {
      throw new Error('repository must be in format "owner/repo"');
    }

    try {
      const tool = this.adapter.getTool('github_create_issue');
      if (!tool) {
        throw new Error('github_create_issue tool not available');
      }

      // Invoke the LangChain tool
      const result = await tool.invoke({
        repository,
        title,
        body,
        labels: labels.length > 0 ? labels : undefined,
        assignees: assignees.length > 0 ? assignees : undefined,
      });

      return this._parseToolResult(result);
    } catch (error) {
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Update an existing GitHub issue
   * @param {string} repository - Repository in format "owner/repo"
   * @param {number} issueNumber - Issue number to update
   * @param {Object} data - Update data
   * @param {string} [data.title] - Optional new title
   * @param {string} [data.body] - Optional new body
   * @param {string} [data.state] - Optional state change ('open' or 'closed')
   * @param {string[]} [data.labels] - Optional new labels (replaces existing)
   * @param {string[]} [data.assignees] - Optional new assignees (replaces existing)
   * @returns {Promise<Object>} Updated issue data
   * @throws {Error} If update fails
   */
  async updateIssue(repository, issueNumber, data) {
    if (!repository || !issueNumber) {
      throw new Error('repository and issueNumber are required to update an issue');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new Error('data object with at least one field is required for update');
    }

    // Validate repository format
    if (!repository.includes('/')) {
      throw new Error('repository must be in format "owner/repo"');
    }

    try {
      const tool = this.adapter.getTool('github_update_issue');
      if (!tool) {
        throw new Error('github_update_issue tool not available');
      }

      // Build update payload
      const updatePayload = {
        repository,
        issue_number: issueNumber,
        ...data,
      };

      // Invoke the LangChain tool
      const result = await tool.invoke(updatePayload);

      return this._parseToolResult(result);
    } catch (error) {
      throw new Error(`Failed to update GitHub issue: ${error.message}`);
    }
  }

  /**
   * Search for GitHub issues
   * @param {string} repository - Repository in format "owner/repo"
   * @param {string} query - Search query (GitHub search syntax)
   * @param {Object} [options] - Search options
   * @param {string} [options.state] - Filter by state ('open', 'closed', 'all')
   * @param {string[]} [options.labels] - Filter by labels
   * @param {string} [options.sort] - Sort by ('created', 'updated', 'comments')
   * @param {string} [options.order] - Sort order ('asc' or 'desc')
   * @param {number} [options.per_page] - Results per page (max 100)
   * @param {number} [options.page] - Page number
   * @returns {Promise<Object>} Search results with items array
   * @throws {Error} If search fails
   */
  async searchIssues(repository, query, options = {}) {
    if (!repository || !query) {
      throw new Error('repository and query are required to search issues');
    }

    // Validate repository format
    if (!repository.includes('/')) {
      throw new Error('repository must be in format "owner/repo"');
    }

    try {
      const tool = this.adapter.getTool('github_search_issues');
      if (!tool) {
        throw new Error('github_search_issues tool not available');
      }

      // Build search query with repository scope
      const fullQuery = `repo:${repository} ${query}`;

      // Build search payload
      const searchPayload = {
        query: fullQuery,
        ...options,
      };

      // Invoke the LangChain tool
      const result = await tool.invoke(searchPayload);

      return this._parseToolResult(result);
    } catch (error) {
      throw new Error(`Failed to search GitHub issues: ${error.message}`);
    }
  }

  /**
   * Close a GitHub issue
   * Convenience wrapper around updateIssue
   * @param {string} repository - Repository in format "owner/repo"
   * @param {number} issueNumber - Issue number to close
   * @returns {Promise<Object>} Updated issue data
   */
  async closeIssue(repository, issueNumber) {
    return this.updateIssue(repository, issueNumber, { state: 'closed' });
  }

  /**
   * Reopen a GitHub issue
   * Convenience wrapper around updateIssue
   * @param {string} repository - Repository in format "owner/repo"
   * @param {number} issueNumber - Issue number to reopen
   * @returns {Promise<Object>} Updated issue data
   */
  async reopenIssue(repository, issueNumber) {
    return this.updateIssue(repository, issueNumber, { state: 'open' });
  }

  /**
   * Add labels to a GitHub issue
   * @param {string} repository - Repository in format "owner/repo"
   * @param {number} issueNumber - Issue number
   * @param {string[]} labels - Labels to add
   * @returns {Promise<Object>} Updated issue data
   */
  async addLabels(repository, issueNumber, labels) {
    if (!labels || labels.length === 0) {
      throw new Error('At least one label is required');
    }

    // First, get current issue to preserve existing labels
    const searchResult = await this.searchIssues(repository, `is:issue ${issueNumber}`);
    const issue = searchResult.items?.[0];

    if (!issue) {
      throw new Error(`Issue #${issueNumber} not found`);
    }

    // Merge existing labels with new ones
    const existingLabels = issue.labels?.map(l => l.name) || [];
    const allLabels = [...new Set([...existingLabels, ...labels])];

    return this.updateIssue(repository, issueNumber, { labels: allLabels });
  }

  /**
   * Parse tool result and extract data
   * Handles different response formats from MCP tools
   * @private
   * @param {*} result - Raw tool result
   * @returns {Object} Parsed result
   */
  _parseToolResult(result) {
    // Handle different response formats
    if (typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return { raw: result };
      }
    }

    if (result && typeof result === 'object') {
      return result;
    }

    return { result };
  }

  /**
   * Get the underlying MCP adapter
   * @returns {GitHubMCPAdapter}
   */
  getAdapter() {
    return this.adapter;
  }
}

/**
 * Create GitHub tools instance
 * @param {string} [serverUrl] - Optional MCP server URL
 * @param {string} authToken - GitHub Personal Access Token
 * @returns {Promise<GitHubTools>} Initialized GitHubTools instance
 */
export async function createGitHubTools(serverUrl = null, authToken) {
  const adapter = await createGitHubMCPAdapter(serverUrl, authToken);
  return new GitHubTools(adapter);
}

/**
 * Singleton tools instance
 */
let sharedToolsInstance = null;

/**
 * Get or create shared GitHub tools instance
 * @param {string} [serverUrl] - Optional MCP server URL
 * @param {string} authToken - GitHub Personal Access Token
 * @returns {Promise<GitHubTools>} Shared tools instance
 */
export async function getSharedGitHubTools(serverUrl = null, authToken) {
  if (!sharedToolsInstance) {
    sharedToolsInstance = await createGitHubTools(serverUrl, authToken);
  }
  return sharedToolsInstance;
}

/**
 * Reset shared tools instance
 */
export function resetSharedTools() {
  sharedToolsInstance = null;
}
