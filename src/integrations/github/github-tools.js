/**
 * GitHub Tools Integration
 * Uses LangChain MCP Adapters to connect to GitHub MCP server
 *
 * @module integrations/github/github-tools
 */

import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { getConfig } from '../../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * GitHub Tools class
 * Provides LangChain tools for GitHub operations via MCP
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
            type: 'http',
            url: config.github.mcpServerUrl,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        },
      });

      // Establish connection to MCP server
      await this.mcpClient.initializeConnections();

      // Load and cache tools
      const allTools = await this.mcpClient.getTools();

      // Log all available tools for debugging
      logger.info(
        {
          toolCount: allTools.length,
          toolNames: allTools.map(t => t.name),
          allTools: allTools.map(t => ({ name: t.name, description: t.description }))
        },
        'All available MCP tools'
      );

      // Filter to only GitHub issue tools
      this.tools = allTools.filter(tool =>
        ['issue_write', 'issue_read', 'search_issues', 'list_issues', 'add_issue_comment'].includes(
          tool.name
        )
      );

      if (this.tools.length === 0) {
        throw new Error(
          `No GitHub issue tools found. Expected: issue_write, issue_read, search_issues. Available: ${allTools.map(t => t.name).join(', ')}`
        );
      }

      logger.info(
        { toolCount: this.tools.length, tools: this.tools.map(t => t.name) },
        'GitHub tools initialized'
      );
    } catch (error) {
      throw new Error(`Failed to initialize GitHub tools: ${error.message}`);
    }
  }

  /**
   * Get all available LangChain tools for use in AI agents
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
    sharedToolsInstance.close().catch(err => logger.error({ err }, 'Error closing tools'));
    sharedToolsInstance = null;
  }
}
