/**
 * Environment configuration loader with validation
 * Uses Zod for runtime validation of environment variables
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Define validation schema for environment variables
const envSchema = z.object({
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHAT_IDS: z.string().min(1, 'TELEGRAM_CHAT_IDS is required'),

  // GitHub Configuration
  GITHUB_MCP_SERVER_URL: z.string().url().optional().default('http://localhost:3000/mcp'),

  // Database Configuration
  POSTGRES_HOST: z.string().optional().default('localhost'),
  POSTGRES_PORT: z.string().optional().default('5432'),
  POSTGRES_DB: z.string().optional().default('telegit'),
  POSTGRES_USER: z.string().optional().default('postgres'),
  POSTGRES_PASSWORD: z.string().optional(),

  // Security Configuration
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  // LLM Configuration
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).optional().default('openai'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().optional().default('gpt-4'),
  OPENAI_TEMPERATURE: z.string().optional().default('0.7'),

  // Intent Classifier Configuration
  INTENT_CLASSIFIER_MODEL: z.string().optional().default('gpt-4'),
  INTENT_CLASSIFIER_TEMPERATURE: z.string().optional().default('0.3'),
  INTENT_CONFIDENCE_THRESHOLD: z.string().optional().default('0.3'),

  // Generator Configuration
  GENERATOR_TEMPERATURE: z.string().optional().default('0.7'),

  // Application Configuration
  PORT: z.string().optional().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  RATE_LIMIT_MAX_CONCURRENT: z.string().optional().default('5'),
  RATE_LIMIT_MIN_TIME: z.string().optional().default('1000'),
});

/**
 * Validates and parses environment variables
 * @returns {import('../src/types/config.js').ParsedConfig} Parsed configuration object
 * @throws {Error} If validation fails
 */
export function loadConfig() {
  try {
    // Validate environment variables
    const env = envSchema.parse(process.env);

    // Build database configuration from POSTGRES_* variables
    const host = env.POSTGRES_HOST;
    const port = parseInt(env.POSTGRES_PORT, 10);
    const database = env.POSTGRES_DB;
    const user = env.POSTGRES_USER;
    const password = env.POSTGRES_PASSWORD;

    // Build database URL
    const credentials = password ? `${user}:${password}` : user;
    const url = `postgresql://${credentials}@${host}:${port}/${database}`;

    const databaseConfig = {
      host,
      port,
      database,
      user,
      password,
      url,
      max: 20, // Connection pool size (as per PRD)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // Parse and transform into structured config
    const config = {
      telegram: {
        botToken: env.TELEGRAM_BOT_TOKEN,
        allowedChatIds: env.TELEGRAM_CHAT_IDS.split(',').map(id => parseInt(id.trim(), 10)),
      },
      github: {
        mcpServerUrl: env.GITHUB_MCP_SERVER_URL,
      },
      database: databaseConfig,
      security: {
        encryptionKey: env.ENCRYPTION_KEY,
      },
      llm: {
        provider: env.LLM_PROVIDER,
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL,
        temperature: parseFloat(env.OPENAI_TEMPERATURE),
        intentClassifierModel: env.INTENT_CLASSIFIER_MODEL,
        intentClassifierTemperature: parseFloat(env.INTENT_CLASSIFIER_TEMPERATURE),
        intentConfidenceThreshold: parseFloat(env.INTENT_CONFIDENCE_THRESHOLD),
        generatorTemperature: parseFloat(env.GENERATOR_TEMPERATURE),
      },
      app: {
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        port: parseInt(env.PORT, 10),
        rateLimit: {
          maxConcurrent: parseInt(env.RATE_LIMIT_MAX_CONCURRENT, 10),
          minTime: parseInt(env.RATE_LIMIT_MIN_TIME, 10),
        },
      },
    };

    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `  - ${err.path.join('.')}: ${err.message}`).join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

/**
 * Validates environment variables without returning the config
 * Useful for startup checks
 * @returns {boolean} True if validation passes
 * @throws {Error} If validation fails
 */
export function validateEnv() {
  loadConfig();
  return true;
}

// Export a singleton config instance for convenience
let configInstance = null;

/**
 * Gets the singleton config instance
 * @returns {import('../src/types/config.js').ParsedConfig}
 */
export function getConfig() {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
