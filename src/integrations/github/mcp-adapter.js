/**
 * MCP-to-LangChain Tool Adapter
 * Wraps GitHub MCP server as LangChain tools using official adapter
 *
 * @module integrations/github/mcp-adapter
 */

import { wrapMCPServer } from '@langchain/mcp-adapters';
import { getConfig } from '../../../config/env.js';

/**
 * List of GitHub MCP tools to expose as LangChain tools
 * Only these specific tools will be wrapped and made available
 */
const GITHUB_MCP_TOOLS = [
  'github_create_issue',
  'github_update_issue',
  'github_search_issues',
];

/**
 * GitHub MCP Adapter class
 * Manages the connection between MCP server and LangChain
 */
export class GitHubMCPAdapter {
  constructor() {
    this.tools = null;
    this.serverUrl = null;
    this.authToken = null;
  }

  /**
   * Initialize the adapter and wrap MCP server as LangChain tools
   * @param {string} [serverUrl] - Optional MCP server URL, defaults to config
   * @param {string} authToken - GitHub Personal Access Token for authentication
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails
   */
  async initialize(serverUrl = null, authToken) {
    if (!authToken) {
      throw new Error('GitHub PAT (authToken) is required for MCP adapter initialization');
    }

    try {
      const config = getConfig();
      this.serverUrl = serverUrl || config.github.mcpServerUrl;
      this.authToken = authToken;

      // Wrap the MCP server as LangChain tools
      // The wrapMCPServer function from @langchain/mcp-adapters
      // returns an array of LangChain tools that can be used in agents
      this.tools = await wrapMCPServer({
        url: this.serverUrl,
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      // Filter to only include the GitHub tools we need
      this.tools = this.tools.filter(tool =>
        GITHUB_MCP_TOOLS.includes(tool.name)
      );

      if (this.tools.length === 0) {
        throw new Error(
          `No matching GitHub MCP tools found. Expected tools: ${GITHUB_MCP_TOOLS.join(', ')}`
        );
      }

      console.log(
        `GitHub MCP adapter initialized with ${this.tools.length} tools: ${this.tools.map(t => t.name).join(', ')}`
      );
    } catch (error) {
      throw new Error(`Failed to initialize GitHub MCP adapter: ${error.message}`);
    }
  }

  /**
   * Get all wrapped LangChain tools
   * @returns {Array} Array of LangChain tools
   * @throws {Error} If adapter not initialized
   */
  getTools() {
    if (!this.tools) {
      throw new Error('MCP adapter not initialized. Call initialize() first.');
    }
    return this.tools;
  }

  /**
   * Get a specific tool by name
   * @param {string} toolName - Name of the tool to retrieve
   * @returns {Object|null} The requested tool or null if not found
   * @throws {Error} If adapter not initialized
   */
  getTool(toolName) {
    if (!this.tools) {
      throw new Error('MCP adapter not initialized. Call initialize() first.');
    }

    return this.tools.find(tool => tool.name === toolName) || null;
  }

  /**
   * Get tools by category/pattern
   * @param {RegExp|string} pattern - Pattern to match tool names
   * @returns {Array} Matching tools
   * @throws {Error} If adapter not initialized
   */
  getToolsByPattern(pattern) {
    if (!this.tools) {
      throw new Error('MCP adapter not initialized. Call initialize() first.');
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.tools.filter(tool => regex.test(tool.name));
  }

  /**
   * Check if a specific tool is available
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean}
   */
  hasTool(toolName) {
    if (!this.tools) {
      return false;
    }
    return this.tools.some(tool => tool.name === toolName);
  }

  /**
   * Get the list of available tool names
   * @returns {string[]} Array of tool names
   * @throws {Error} If adapter not initialized
   */
  getToolNames() {
    if (!this.tools) {
      throw new Error('MCP adapter not initialized. Call initialize() first.');
    }
    return this.tools.map(tool => tool.name);
  }

  /**
   * Reinitialize the adapter with new credentials
   * Useful when switching between different GitHub repositories or users
   * @param {string} [serverUrl] - Optional new server URL
   * @param {string} authToken - New GitHub PAT
   * @returns {Promise<void>}
   */
  async reinitialize(serverUrl = null, authToken) {
    this.tools = null;
    await this.initialize(serverUrl, authToken);
  }

  /**
   * Check if the adapter is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.tools !== null && this.tools.length > 0;
  }
}

/**
 * Create and initialize a GitHub MCP adapter
 * @param {string} [serverUrl] - Optional MCP server URL
 * @param {string} authToken - GitHub Personal Access Token
 * @returns {Promise<GitHubMCPAdapter>} Initialized adapter instance
 */
export async function createGitHubMCPAdapter(serverUrl = null, authToken) {
  const adapter = new GitHubMCPAdapter();
  await adapter.initialize(serverUrl, authToken);
  return adapter;
}

/**
 * Singleton adapter instance for sharing across the application
 */
let sharedAdapterInstance = null;

/**
 * Get or create a shared GitHub MCP adapter instance
 * @param {string} [serverUrl] - Optional MCP server URL
 * @param {string} authToken - GitHub Personal Access Token
 * @returns {Promise<GitHubMCPAdapter>} Shared adapter instance
 */
export async function getSharedGitHubMCPAdapter(serverUrl = null, authToken) {
  if (!sharedAdapterInstance || !sharedAdapterInstance.isInitialized()) {
    sharedAdapterInstance = await createGitHubMCPAdapter(serverUrl, authToken);
  }
  return sharedAdapterInstance;
}

/**
 * Reset the shared adapter instance
 * Useful for testing or when switching contexts
 */
export function resetSharedAdapter() {
  sharedAdapterInstance = null;
}

/**
 * Helper function to get LangChain tools directly
 * Convenience wrapper around createGitHubMCPAdapter
 * @param {string} [serverUrl] - Optional MCP server URL
 * @param {string} authToken - GitHub Personal Access Token
 * @returns {Promise<Array>} Array of LangChain tools
 */
export async function getGitHubLangChainTools(serverUrl = null, authToken) {
  const adapter = await createGitHubMCPAdapter(serverUrl, authToken);
  return adapter.getTools();
}
