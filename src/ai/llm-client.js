/**
 * LLM Client Initialization
 * Supports multiple LLM providers (OpenAI, Anthropic) with retry logic
 *
 * Task 4.1.1: Initialize LLM Clients
 */

import { ChatOpenAI } from '@langchain/openai';
import { getConfig } from '../../config/env.js';

/**
 * Supported LLM providers
 * @enum {string}
 */
export const LLMProvider = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
};

/**
 * Creates an LLM client instance based on configuration
 *
 * @param {Object} options - Configuration options
 * @param {string} [options.provider] - LLM provider to use (openai or anthropic)
 * @param {string} [options.model] - Model name to use
 * @param {number} [options.temperature] - Temperature for responses (0-1)
 * @param {number} [options.maxRetries] - Maximum number of retries on failure
 * @param {number} [options.timeout] - Request timeout in milliseconds
 * @returns {ChatOpenAI} Configured LLM client instance
 * @throws {Error} If configuration is invalid or provider is unsupported
 */
export function createLLMClient(options = {}) {
  const config = getConfig();

  // Merge options with config defaults
  const provider = options.provider || config.llm.provider;
  const model = options.model || config.llm.model;
  const temperature = options.temperature !== undefined ? options.temperature : config.llm.temperature;
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 30000; // 30 seconds default

  // Validate provider
  if (!Object.values(LLMProvider).includes(provider)) {
    throw new Error(`Unsupported LLM provider: ${provider}. Supported providers: ${Object.values(LLMProvider).join(', ')}`);
  }

  // Initialize based on provider
  switch (provider) {
    case LLMProvider.OPENAI:
      return createOpenAIClient({ model, temperature, maxRetries, timeout, config });

    case LLMProvider.ANTHROPIC:
      // Anthropic support to be implemented when needed
      throw new Error('Anthropic provider not yet implemented. Use OpenAI for now.');

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Creates an OpenAI LLM client
 *
 * @param {Object} params - Configuration parameters
 * @param {string} params.model - Model name
 * @param {number} params.temperature - Temperature setting
 * @param {number} params.maxRetries - Maximum retries
 * @param {number} params.timeout - Request timeout
 * @param {Object} params.config - Application configuration
 * @returns {ChatOpenAI} OpenAI client instance
 * @throws {Error} If API key is missing
 */
function createOpenAIClient({ model, temperature, maxRetries, timeout, config }) {
  if (!config.llm.apiKey) {
    throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
  }

  return new ChatOpenAI({
    openAIApiKey: config.llm.apiKey,
    modelName: model,
    temperature,
    maxRetries,
    timeout,
    // Enable streaming for better UX in future
    streaming: false,
    // Verbose logging in development
    verbose: config.app.nodeEnv === 'development',
  });
}

/**
 * Gets a default LLM client instance using environment configuration
 * This is a convenience function for common usage
 *
 * @returns {ChatOpenAI} Default configured LLM client
 */
export function getDefaultLLMClient() {
  return createLLMClient();
}

/**
 * Gets an LLM client optimized for intent classification
 * Uses lower temperature for more deterministic outputs
 *
 * @returns {ChatOpenAI} LLM client configured for classification
 */
export function getClassifierLLMClient() {
  const config = getConfig();

  return createLLMClient({
    temperature: config.llm.intentClassifierTemperature,
    model: config.llm.intentClassifierModel,
  });
}

/**
 * Gets an LLM client optimized for content generation
 * Uses moderate temperature for more creative outputs
 *
 * @returns {ChatOpenAI} LLM client configured for generation
 */
export function getGeneratorLLMClient() {
  const config = getConfig();

  return createLLMClient({
    temperature: config.llm.generatorTemperature,
  });
}

/**
 * Validates that the LLM client can connect to the API
 * Useful for health checks and startup validation
 *
 * @param {ChatOpenAI} client - LLM client to test
 * @returns {Promise<boolean>} True if connection is successful
 * @throws {Error} If connection fails
 */
export async function validateLLMConnection(client) {
  try {
    // Send a minimal test request
    const response = await client.invoke([
      { role: 'user', content: 'test' }
    ]);

    return response && response.content !== undefined;
  } catch (error) {
    throw new Error(`LLM connection validation failed: ${error.message}`);
  }
}
