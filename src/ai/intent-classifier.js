/**
 * Intent Classifier
 * Uses LLM to analyze Telegram messages and classify user intent
 *
 * Task 4.2.1: Implement Intent Classifier
 */

import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { getClassifierLLMClient } from './llm-client.js';
import { IntentType } from './state-schema.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Schema for intent classification output
 * Ensures LLM returns properly structured data
 */
const intentOutputSchema = z.object({
  intent: z.enum([
    IntentType.CREATE_BUG,
    IntentType.CREATE_TASK,
    IntentType.CREATE_IDEA,
    IntentType.UPDATE_ISSUE,
    IntentType.SEARCH_ISSUES,
    IntentType.UNKNOWN,
  ]).describe('The classified intent type'),

  confidence: z.number()
    .min(0)
    .max(1)
    .describe('Confidence score for the classification (0-1)'),

  entities: z.object({
    title: z.string()
      .optional()
      .describe('Extracted title for the issue'),

    description: z.string()
      .optional()
      .describe('Extracted description or body for the issue'),

    labels: z.array(z.string())
      .optional()
      .describe('Extracted labels from hashtags or context'),

    assignees: z.array(z.string())
      .optional()
      .describe('Extracted assignees from @mentions'),

    issueNumber: z.string()
      .optional()
      .describe('Issue number if updating an existing issue'),

    searchQuery: z.string()
      .optional()
      .describe('Search query if searching for issues'),
  }).describe('Extracted entities from the message'),

  reasoning: z.string()
    .optional()
    .describe('Brief explanation of the classification decision'),
});

/**
 * Output parser for structured intent classification
 */
const intentParser = StructuredOutputParser.fromZodSchema(intentOutputSchema);

/**
 * Loads the intent classification prompt template
 *
 * @returns {Promise<string>} Prompt template text
 * @throws {Error} If prompt file cannot be loaded
 */
async function loadPromptTemplate() {
  const promptPath = join(__dirname, '../../prompts/intent-classification.txt');

  try {
    return await readFile(promptPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to load intent classification prompt from ${promptPath}: ${error.message}\n` +
      'Make sure the prompts/intent-classification.txt file exists.'
    );
  }
}

/**
 * Classifies intent from a Telegram message
 *
 * @param {Object} params - Classification parameters
 * @param {string} params.message - Message text to classify
 * @param {Object[]} [params.context] - Conversation context (previous messages)
 * @param {Object} [params.messageMetadata] - Additional message metadata
 * @returns {Promise<Object>} Classification result
 * @throws {Error} If classification fails
 */
export async function classifyIntent({ message, context = [], messageMetadata = {} }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message text is required for intent classification');
  }

  // Format context before try block so it's available in catch
  const contextText = formatContext(context);

  try {
    // Load prompt template
    const promptTemplateText = await loadPromptTemplate();

    // Create prompt with format instructions
    const prompt = PromptTemplate.fromTemplate(promptTemplateText);

    // Get LLM client optimized for classification
    const llm = getClassifierLLMClient();

    // Create chain
    const chain = prompt.pipe(llm).pipe(intentParser);

    // Execute classification
    const result = await chain.invoke({
      format_instructions: intentParser.getFormatInstructions(),
      context: contextText,
      message: message.trim(),
    });

    // Post-process and validate result
    return validateAndEnrichResult(result, message, messageMetadata);
  } catch (error) {
    // Log error for debugging
    logger.error({ err: error, message: message.trim(), context: contextText }, 'Intent classification error');

    // Return unknown intent with error info
    return {
      intent: IntentType.UNKNOWN,
      confidence: 0,
      entities: {},
      error: error.message,
    };
  }
}

/**
 * Formats conversation context for the prompt
 *
 * @param {Object[]} context - Array of context messages
 * @returns {string} Formatted context text
 */
function formatContext(context) {
  if (!context || context.length === 0) {
    return 'No previous context available.';
  }

  return context.map((msg, index) => {
    const speaker = msg.from?.username || msg.from?.first_name || 'User';
    const text = msg.text || '[media message]';
    return `[${index + 1}] ${speaker}: ${text}`;
  }).join('\n');
}

/**
 * Validates and enriches the classification result
 *
 * @param {Object} result - Raw classification result
 * @param {string} message - Original message
 * @param {Object} messageMetadata - Message metadata
 * @returns {Object} Validated and enriched result
 */
function validateAndEnrichResult(result, message, messageMetadata) {
  // Ensure confidence is within bounds
  result.confidence = Math.max(0, Math.min(1, result.confidence || 0));

  // Ensure entities object exists
  result.entities = result.entities || {};

  // Auto-extract labels from hashtags if not already extracted
  if (!result.entities.labels || result.entities.labels.length === 0) {
    result.entities.labels = extractHashtags(message);
  }

  // Auto-extract assignees from mentions if not already extracted
  if (!result.entities.assignees || result.entities.assignees.length === 0) {
    result.entities.assignees = extractMentions(message);
  }

  // Generate default title if create intent but no title
  if (isCreateIntent(result.intent) && !result.entities.title) {
    result.entities.title = generateDefaultTitle(message);
  }

  // Use full message as description if none provided
  if (isCreateIntent(result.intent) && !result.entities.description) {
    result.entities.description = message.trim();
  }

  return result;
}

/**
 * Checks if intent is a create type
 *
 * @param {string} intent - Intent type
 * @returns {boolean} True if create intent
 */
function isCreateIntent(intent) {
  return [
    IntentType.CREATE_BUG,
    IntentType.CREATE_TASK,
    IntentType.CREATE_IDEA,
  ].includes(intent);
}

/**
 * Extracts hashtags from message text
 *
 * @param {string} text - Message text
 * @returns {string[]} Array of hashtags (without # symbol)
 */
function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const matches = [...text.matchAll(hashtagRegex)];
  return matches.map(match => match[1].toLowerCase());
}

/**
 * Extracts @mentions from message text
 *
 * @param {string} text - Message text
 * @returns {string[]} Array of usernames (without @ symbol)
 */
function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];
  return matches.map(match => match[1]);
}

/**
 * Generates a default title from message text
 *
 * @param {string} message - Message text
 * @returns {string} Generated title
 */
function generateDefaultTitle(message) {
  // Take first sentence or first 60 characters
  const firstSentence = message.match(/^[^.!?]+/)?.[0] || message;
  const title = firstSentence.trim().substring(0, 60);

  // Remove hashtags and mentions from title
  return title.replace(/#\w+/g, '').replace(/@\w+/g, '').trim();
}

/**
 * Batch classifies multiple messages
 * Useful for testing and evaluation
 *
 * @param {Array<{message: string, context?: Object[]}>} messages - Array of messages to classify
 * @returns {Promise<Object[]>} Array of classification results
 */
export async function batchClassifyIntents(messages) {
  const results = await Promise.all(
    messages.map(({ message, context }) =>
      classifyIntent({ message, context })
    )
  );

  return results;
}

/**
 * Re-exports for convenience
 */
export { IntentType, intentOutputSchema };
