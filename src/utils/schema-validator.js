/**
 * Schema Validation Module
 *
 * Provides schema validation for LLM outputs and structured data.
 * Uses Zod for runtime type checking and validation.
 *
 * This module validates:
 * - Intent classification outputs
 * - Entity extraction results
 * - GitHub operation parameters
 * - Configuration objects
 */

import { z } from 'zod';

/**
 * Intent types supported by the bot
 */
export const INTENT_TYPES = [
  'create_bug',
  'create_task',
  'create_idea',
  'update_issue',
  'search_issues',
  'unknown'
];

/**
 * Schema for intent classification output
 */
export const IntentSchema = z.object({
  intent: z.enum(['create_bug', 'create_task', 'create_idea', 'update_issue', 'search_issues', 'unknown']),
  confidence: z.number().min(0).max(1),
  entities: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    issueNumber: z.number().optional(),
    searchQuery: z.string().optional()
  }).optional()
});

/**
 * Schema for GitHub issue creation parameters
 */
export const GitHubIssueSchema = z.object({
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/),
  title: z.string().min(1).max(256),
  body: z.string().max(65536),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional()
});

/**
 * Schema for GitHub issue update parameters
 */
export const GitHubIssueUpdateSchema = z.object({
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/),
  issueNumber: z.number().positive().int(),
  title: z.string().min(1).max(256).optional(),
  body: z.string().max(65536).optional(),
  state: z.enum(['open', 'closed']).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional()
});

/**
 * Schema for GitHub issue search parameters
 */
export const GitHubSearchSchema = z.object({
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/),
  query: z.string().min(1),
  state: z.enum(['open', 'closed', 'all']).optional(),
  labels: z.array(z.string()).optional(),
  limit: z.number().positive().int().max(100).optional()
});

/**
 * Schema for Telegram message metadata
 */
export const TelegramMessageSchema = z.object({
  messageId: z.number().positive().int(),
  chatId: z.number().int(),
  userId: z.number().positive().int(),
  text: z.string(),
  replyToMessageId: z.number().positive().int().optional(),
  hasImage: z.boolean().optional(),
  timestamp: z.number().positive().int()
});

/**
 * Schema for bot configuration
 */
export const BotConfigSchema = z.object({
  telegramBotToken: z.string().min(1),
  encryptionKey: z.string().regex(/^[0-9a-fA-F]{64}$/),
  databaseUrl: z.string().url(),
  allowedGroups: z.array(z.number().int()).optional(),
  allowedUsers: z.array(z.number().positive().int()).optional(),
  llmModel: z.string().optional(),
  llmApiKey: z.string().optional()
});

/**
 * Validate intent classification output
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 *
 * @example
 * const result = validateIntent({
 *   intent: 'create_bug',
 *   confidence: 0.95,
 *   entities: { title: 'Fix login bug', labels: ['bug'] }
 * });
 * if (result.valid) {
 *   console.log('Valid intent:', result.data);
 * }
 */
export function validateIntent(data) {
  try {
    const validated = IntentSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate GitHub issue creation parameters
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 *
 * @example
 * const result = validateGitHubIssue({
 *   repository: 'owner/repo',
 *   title: 'Bug report',
 *   body: 'Description of the bug'
 * });
 */
export function validateGitHubIssue(data) {
  try {
    const validated = GitHubIssueSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate GitHub issue update parameters
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 */
export function validateGitHubIssueUpdate(data) {
  try {
    const validated = GitHubIssueUpdateSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate GitHub search parameters
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 */
export function validateGitHubSearch(data) {
  try {
    const validated = GitHubSearchSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate Telegram message metadata
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 */
export function validateTelegramMessage(data) {
  try {
    const validated = TelegramMessageSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate bot configuration
 *
 * @param {unknown} data - Data to validate
 * @returns {{valid: boolean, data?: any, errors?: string[]}} Validation result
 */
export function validateBotConfig(data) {
  try {
    const validated = BotConfigSchema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Create a custom validator from a Zod schema
 *
 * @param {z.ZodSchema} schema - Zod schema to use for validation
 * @returns {Function} Validator function
 *
 * @example
 * const MySchema = z.object({ name: z.string(), age: z.number() });
 * const validate = createValidator(MySchema);
 * const result = validate({ name: 'John', age: 30 });
 */
export function createValidator(schema) {
  return function validate(data) {
    try {
      const validated = schema.parse(data);
      return { valid: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: ['Unknown validation error'] };
    }
  };
}

/**
 * Safe parse - returns null on validation failure instead of throwing
 *
 * @param {z.ZodSchema} schema - Zod schema to use
 * @param {unknown} data - Data to validate
 * @returns {any|null} Validated data or null
 *
 * @example
 * const result = safeParse(IntentSchema, someData);
 * if (result) {
 *   // Use validated data
 * } else {
 *   // Handle invalid data
 * }
 */
export function safeParse(schema, data) {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
