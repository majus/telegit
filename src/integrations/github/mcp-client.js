/**
 * MCP Client for GitHub Integration
 * Implements Model Context Protocol (MCP) client with SSE transport
 *
 * @module integrations/github/mcp-client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getConfig } from '../../../config/env.js';

/**
 * MCP Client class for managing GitHub MCP server connection
 */
export class MCPClient {
  constructor() {
    this.client = null;
    this.transport = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000; // 2 seconds initial delay
  }

  /**
   * Initialize and connect to the MCP server
   * @param {string} [serverUrl] - Optional server URL, defaults to config value
   * @param {string} [authToken] - Optional GitHub PAT for authentication
   * @returns {Promise<void>}
   * @throws {Error} If connection fails
   */
  async connect(serverUrl = null, authToken = null) {
    try {
      const config = getConfig();
      const url = serverUrl || config.github.mcpServerUrl;

      if (!url) {
        throw new Error('MCP server URL not configured');
      }

      // Create SSE transport
      this.transport = new SSEClientTransport(new URL(url));

      // Create MCP client
      this.client = new Client(
        {
          name: 'telegit-github-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Set up authentication if token provided
      if (authToken) {
        this.transport.headers = {
          Authorization: `Bearer ${authToken}`,
        };
      }

      // Connect to the server
      await this.client.connect(this.transport);

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log(`MCP client connected to ${url}`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from the MCP server
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
      }
      this.isConnected = false;
      console.log('MCP client disconnected');
    } catch (error) {
      console.error('Error disconnecting MCP client:', error);
      throw error;
    }
  }

  /**
   * Reconnect to the MCP server with exponential backoff
   * @param {string} [serverUrl] - Optional server URL
   * @param {string} [authToken] - Optional auth token
   * @returns {Promise<void>}
   * @throws {Error} If max reconnection attempts exceeded
   */
  async reconnect(serverUrl = null, authToken = null) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error(
        `Maximum reconnection attempts (${this.maxReconnectAttempts}) exceeded`
      );
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`
    );

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.disconnect();
      await this.connect(serverUrl, authToken);
      console.log('Reconnection successful');
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get the list of available tools from the MCP server
   * @returns {Promise<Array>} List of available tools
   * @throws {Error} If not connected or request fails
   */
  async listTools() {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.listTools();
      return response.tools || [];
    } catch (error) {
      throw new Error(`Failed to list MCP tools: ${error.message}`);
    }
  }

  /**
   * Call a tool on the MCP server
   * @param {string} toolName - Name of the tool to call
   * @param {Object} args - Arguments for the tool
   * @returns {Promise<Object>} Tool execution result
   * @throws {Error} If not connected or tool call fails
   */
  async callTool(toolName, args = {}) {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      return response;
    } catch (error) {
      throw new Error(`Failed to call MCP tool '${toolName}': ${error.message}`);
    }
  }

  /**
   * Check if the client is connected
   * @returns {boolean}
   */
  isClientConnected() {
    return this.isConnected;
  }

  /**
   * Get the underlying MCP client instance
   * @returns {Client|null}
   */
  getClient() {
    return this.client;
  }
}

/**
 * Create and initialize a new MCP client instance
 * @param {string} [serverUrl] - Optional server URL
 * @param {string} [authToken] - Optional auth token
 * @returns {Promise<MCPClient>} Connected MCP client instance
 */
export async function createMCPClient(serverUrl = null, authToken = null) {
  const client = new MCPClient();
  await client.connect(serverUrl, authToken);
  return client;
}

/**
 * Singleton MCP client instance
 * Use getSharedMCPClient() to access
 */
let sharedClientInstance = null;

/**
 * Get or create a shared MCP client instance
 * This is useful for sharing a single connection across the application
 * @param {string} [serverUrl] - Optional server URL
 * @param {string} [authToken] - Optional auth token
 * @returns {Promise<MCPClient>} Shared MCP client instance
 */
export async function getSharedMCPClient(serverUrl = null, authToken = null) {
  if (!sharedClientInstance || !sharedClientInstance.isClientConnected()) {
    sharedClientInstance = await createMCPClient(serverUrl, authToken);
  }
  return sharedClientInstance;
}

/**
 * Close the shared MCP client instance
 * @returns {Promise<void>}
 */
export async function closeSharedMCPClient() {
  if (sharedClientInstance) {
    await sharedClientInstance.disconnect();
    sharedClientInstance = null;
  }
}
