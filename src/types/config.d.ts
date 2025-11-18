/**
 * Environment configuration types
 */

export interface EnvironmentConfig {
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_IDS: string; // Comma-separated list of allowed chat IDs

  // GitHub Configuration
  GITHUB_MCP_SERVER_URL?: string; // Optional, defaults to local MCP server

  // Database Configuration
  DATABASE_URL: string;

  // Security Configuration
  ENCRYPTION_KEY: string; // 64 hex characters (32 bytes) for AES-256-GCM encryption

  // LLM Configuration
  OPENAI_API_KEY: string;
  OPENAI_MODEL?: string; // Optional, defaults to gpt-4
  OPENAI_TEMPERATURE?: string;

  // Application Configuration
  NODE_ENV?: string; // 'development' | 'production' | 'test'
  LOG_LEVEL?: string; // 'debug' | 'info' | 'warn' | 'error'
  RATE_LIMIT_MAX_CONCURRENT?: string;
  RATE_LIMIT_MIN_TIME?: string;
}

export interface ParsedConfig {
  telegram: {
    botToken: string;
    allowedChatIds: number[];
  };
  github: {
    mcpServerUrl: string;
  };
  database: {
    url: string;
  };
  security: {
    encryptionKey: string;
  };
  llm: {
    apiKey: string;
    model: string;
    temperature: number;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
    rateLimit: {
      maxConcurrent: number;
      minTime: number;
    };
  };
}
