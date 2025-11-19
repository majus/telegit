/**
 * GitHub Tools Integration
 * Uses LangChain MCP Adapters to connect to GitHub MCP server
 *
 * @module integrations/github/github-tools
 */

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { getConfig } from '../../../config/env.js';

/**
 * GitHub Tools class
 * Provides high-level interface for GitHub issue operations via MCP
 */
export class GitHubTools {
  constructor() {
    this.mcpClient = null;
    this.tools = null;
    this.authToken = null;
    this.repository = null;
  }

  /**
   * Initialize the GitHub tools with MCP client
   * @param {string} authToken - GitHub Personal Access Token
   * @param {string} [repository] - Optional repository in format "owner/repo"
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize(authToken, repository = null) {
    if (!authToken) {
      throw new Error('GitHub PAT (authToken) is required for initialization');
    }

    try {
      const config = getConfig();
      this.authToken = authToken;
      this.repository = repository;

      // Initialize MultiServerMCPClient with GitHub MCP server
      this.mcpClient = new MultiServerMCPClient({
        throwOnLoadError: true,
        prefixToolNameWithServerName: false,
        useStandardContentBlocks: true,
        mcpServers: {
          github: {
            url: config.github.mcpServerUrl,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            automaticSSEFallback: true,
          },
        },
      });

      // Establish connection to MCP server
      await this.mcpClient.initializeConnections();

      // Load and cache tools
      this.tools = await this.mcpClient.getTools();

      // Filter to only GitHub issue tools
      this.tools = this.tools.filter(tool =>
        ['github_create_issue', 'github_update_issue', 'github_search_issues'].includes(
          tool.name
        )
      );

      if (this.tools.length === 0) {
        throw new Error(
          'No GitHub issue tools found. Expected: github_create_issue, github_update_issue, github_search_issues'
        );
      }

      console.log(
        `GitHub tools initialized with ${this.tools.length} tools: ${this.tools.map(t => t.name).join(', ')}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize GitHub tools: ${error.message}`);
    }
  }

  /**
   * Get all available LangChain tools
   * @returns {Array} Array of LangChain tools
   * @throws {Error} If not initialized
   */
  getTools() {
    if (!this.tools) {
      throw new Error('GitHub tools not initialized. Call initialize() first.');
    }
    return this.tools;
  }

  /**
   * Get a specific tool by name
   * @param {string} toolName - Tool name
   * @returns {Object|null} Tool or null if not found
   */
  getTool(toolName) {
    if (!this.tools) {
      return null;
    }
    return this.tools.find(tool => tool.name === toolName) || null;
  }

  /**
   * Check if tools are initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.tools !== null && this.tools.length > 0;
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
      const tool = this.getTool('github_create_issue');
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
      const tool = this.getTool('github_update_issue');
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
      const tool = this.getTool('github_search_issues');
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
   * Reinitialize with new credentials
   * Useful when switching between different GitHub repositories or users
   * @param {string} authToken - New GitHub PAT
   * @param {string} [repository] - Optional new repository
   * @returns {Promise<void>}
   */
  async reinitialize(authToken, repository = null) {
    await this.close();
    await this.initialize(authToken, repository);
  }

  /**
   * Close the MCP client and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
      this.tools = null;
    }
  }

  /**
   * Get the underlying MCP client
   * @returns {MultiServerMCPClient|null}
   */
  getMCPClient() {
    return this.mcpClient;
  }
}

/**
 * Create and initialize a GitHub tools instance
 * @param {string} authToken - GitHub Personal Access Token
 * @param {string} [repository] - Optional repository
 * @returns {Promise<GitHubTools>} Initialized tools instance
 */
export async function createGitHubTools(authToken, repository = null) {
  const tools = new GitHubTools();
  await tools.initialize(authToken, repository);
  return tools;
}

/**
 * Singleton tools instance
 */
let sharedToolsInstance = null;

/**
 * Get or create shared GitHub tools instance
 * @param {string} authToken - GitHub Personal Access Token
 * @param {string} [repository] - Optional repository
 * @returns {Promise<GitHubTools>} Shared tools instance
 */
export async function getSharedGitHubTools(authToken, repository = null) {
  if (!sharedToolsInstance || !sharedToolsInstance.isInitialized()) {
    sharedToolsInstance = await createGitHubTools(authToken, repository);
  }
  return sharedToolsInstance;
}

/**
 * Reset shared tools instance
 * Useful for testing or when switching contexts
 */
export function resetSharedTools() {
  if (sharedToolsInstance) {
    sharedToolsInstance.close().catch(err => console.error('Error closing tools:', err));
    sharedToolsInstance = null;
  }
}
