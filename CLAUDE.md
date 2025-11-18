# CLAUDE.md - AI Assistant Guide for TeleGit

This document provides guidance for AI assistants working on the TeleGit codebase.

## Project Overview

**TeleGit** is a minimalist AI-powered Telegram bot that converts chat messages into GitHub issue actions. The bot uses natural language processing (via LLM API) to analyze, classify, and sync messages to GitHub Issues, streamlining idea capture and bug reporting from team Telegram chats.

### Core Philosophy
- **Minimalist & Non-disruptive**: Use emojis for status, temporary feedback messages (auto-deleted after 10 minutes)
- **Optimistic Actions**: Perform actions without constant confirmation, but allow easy correction via reaction-based controls
- **Chat-first Workflow**: Telegram group chat as single entry point for tasks, ideas, and bug reports

## Repository Structure

```
telegit/
├── .git/                     # Git repository
├── .nvm                      # Node.js version (22)
├── db/                       # Database files
│   ├── schema.sql           # PostgreSQL schema definition
│   ├── init.sql             # Database initialization script
│   ├── migrate.js           # Migration runner
│   └── migrations/          # Migration files
│       └── 001_initial_schema.sql
├── src/                      # Source code
│   ├── ai/                  # AI processing engine (Phase 4)
│   │   ├── llm-client.js        # LLM client initialization
│   │   ├── state-schema.js      # LangGraph state schema
│   │   ├── intent-classifier.js # Intent classification
│   │   ├── workflow.js          # LangGraph workflow orchestration
│   │   ├── processor.js         # Main AI message processor
│   │   └── nodes/           # Workflow nodes
│   │       ├── analyze.js   # Intent analysis node
│   │       ├── format.js    # Issue formatting node
│   │       ├── store.js     # Database storage node
│   │       ├── notify.js    # Telegram notification node
│   │       └── error.js     # Error handling node
│   ├── database/            # Database layer
│   │   ├── db.js           # PostgreSQL client setup
│   │   └── repositories/   # Data access repositories
│   │       ├── config.js   # Group configuration repository
│   │       ├── operations.js # Operations tracking repository
│   │       ├── feedback.js # Feedback messages repository
│   │       └── context.js  # Conversation context repository
│   ├── integrations/        # External integrations
│   │   └── github/         # GitHub MCP integration
│   │       ├── mcp-client.js      # MCP client with SSE transport
│   │       ├── mcp-adapter.js     # LangChain tool adapter
│   │       └── tools.js           # GitHub tool wrapper functions
│   ├── services/
│   │   └── telegram/       # Telegram bot service (partial implementation)
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   │   └── encryption.js   # AES-256-GCM encryption utility
│   └── api/                # API endpoints
├── prompts/                 # LLM prompts
│   └── intent-classification.txt
├── test/                    # Test files
│   ├── unit/               # Unit tests
│   │   ├── ai/             # AI component tests
│   │   ├── database/       # Database tests
│   │   │   └── repositories.test.js
│   │   ├── telegram/       # Telegram bot tests
│   │   └── utils/          # Utility tests
│   │       └── encryption.test.js
│   ├── integration/        # Integration tests
│   ├── promptfoo/          # Promptfoo evaluations
│   ├── mocks/              # Mock data generators
│   └── helpers/            # Test helpers
├── config/                 # Configuration files
│   └── env.js              # Environment variable loader with validation
├── package.json            # Project configuration and dependencies
├── README.md               # Comprehensive project documentation
├── CLAUDE.md               # This file - AI assistant guide
└── vitest.config.js        # Test configuration
```

**Current State**: Phase 1 (Project Setup) complete. Phase 5 (GitHub MCP Integration) partially implemented - MCP client, adapter, and tool functions are ready.

## Technical Stack

### Core Technologies
- **Language**: JavaScript (ES modules - `"type": "module"` in package.json)
- **TypeScript**: Only for type definitions, NOT for implementation
- **Runtime**: Node.js >= 22.0.0 (specified in `.nvm`)
- **Testing**: Vitest
- **Deployment**: Docker with Dokploy

### Key Dependencies
- **Telegraf**: NPM library for Telegram Bot API integration
- **PostgreSQL**: Database backend (using `pg` NPM library)
- **GitHub MCP Server**: For GitHub API integration (NOT generic HTTP client)
- **LangChain**: AI agent SDK (@langchain/core, @langchain/openai, @langchain/langgraph, @langchain/mcp-adapters)
- **Promptfoo**: LLM evaluation and testing framework

### Integrations
- Telegram Bot API: https://core.telegram.org/bots/api
- GitHub MCP server: https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md

## Development Conventions

### Code Style
- **JavaScript Only**: Implementation files should be `.js` (ES modules)
- **TypeScript**: Only for `.d.ts` type definition files
- **Module System**: ES modules (`import/export`, not `require()`)
- **Node Version**: Always ensure compatibility with Node.js 22+

### Key Guidelines
- Use GitHub MCP server for GitHub API integration (not generic HTTP clients)
- Keep integrations modular and pluggable
- Use Vitest for testing
- Use emojis for bot status indicators as specified in README.md
- Follow minimalist, non-disruptive design philosophy

### Error Message Guidelines

Provide **consistent, actionable error messages** throughout the codebase:

1. **Clear Description**: Explain what went wrong in plain language
   - ✅ `ENCRYPTION_KEY environment variable is not set.`
   - ❌ `Missing key`

2. **Specific Context**: Include relevant details (field names, expected types, etc.)
   - ✅ `Missing required fields: operationId, chatId, feedbackMessageId, scheduledDeletion`
   - ❌ `Missing fields`

3. **Actionable Steps**: Provide clear steps to resolve the issue
   - For single-step fixes: Direct command or action
   - For multi-step fixes: Numbered list
   - Example:
     ```
     ENCRYPTION_KEY is invalid. It must be 64 hexadecimal characters (32 bytes).
     Generate a new one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```

4. **Relevant Links**: Include URLs to documentation or external resources when applicable
   - Example: `Revoke the PAT at: https://github.com/settings/tokens`

5. **Severity Indicators**: Use clear markers for critical errors
   - ✅ `❌ CRITICAL SECURITY ERROR: Could not delete your PAT message from chat history.`
   - For Telegram bot messages: Use ❌ for errors, ✅ for success

6. **Type Validation**: Provide specific type requirements
   - ✅ `chatId and feedbackMessageId must be numbers`
   - ❌ `Invalid type`

**Examples:**

```javascript
// Environment configuration error
throw new Error(
  'ENCRYPTION_KEY environment variable is not set. ' +
  'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
);

// Security-critical error with multiple steps
return {
  success: false,
  message: `❌ CRITICAL SECURITY ERROR: Could not delete your PAT message from chat history.

For your security, please:
1. Revoke the PAT you just sent at: https://github.com/settings/tokens
2. Delete the message manually if possible
3. Try the setup process again

Your PAT is currently visible in chat history - please revoke it immediately.`,
};

// Validation error with specific context
throw new Error('Missing required fields: operationId, chatId, feedbackMessageId, scheduledDeletion');
```

## Git Workflow

### Branch Naming
- Use descriptive branch names
- Branch format for Claude: `claude/<descriptive-name>-<session-id>`

### Commit Messages
- Use conventional commit format when possible
- Be descriptive about what changes were made
- Reference issues when applicable

### Pushing Changes
- Always push to the designated Claude branch
- Use: `git push -u origin <branch-name>`
- CRITICAL: Branch must start with `claude/` and end with matching session id

## AI Assistant Guidelines

**IMPORTANT**: Do not reflect current project progress or future work in this file. This document should focus on general guidelines and conventions for AI assistants, not track implementation status. Use TASKS.md for tracking progress.

### General Principles
- Read README.md for detailed feature specifications and requirements
- Follow ES module syntax (`import/export`, not `require()`)
- Use GitHub MCP Server for GitHub API (not generic HTTP clients)
- Use LangChain for AI workflows (already integrated)
- Keep integrations modular and pluggable
- Include tests when implementing features (Vitest + Promptfoo)
- Add comments for non-obvious logic
- Update documentation when making changes

### Dependencies
- Update `package.json` when adding dependencies
- Verify compatibility with Node.js 22+
- Prefer well-maintained libraries

### Common Pitfalls
- Don't use TypeScript for implementation (only for `.d.ts` files)
- Don't use generic HTTP clients for GitHub API (use GitHub MCP server)
- Don't hardcode configurations (use environment variables)

## Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegraf Library](https://www.npmjs.com/package/telegraf)
- [GitHub MCP Server](https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md)
- [Dokploy Documentation](https://docs.dokploy.com/docs/core)
- [Vitest Documentation](https://vitest.dev/)
- Project README.md for detailed feature specifications
