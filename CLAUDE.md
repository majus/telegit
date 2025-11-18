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
├── .git/                 # Git repository
├── .nvm                  # Node.js version (24)
├── package.json          # Project configuration and dependencies
├── README.md             # Comprehensive project documentation
└── CLAUDE.md             # This file - AI assistant guide
```

**Current State**: Early stage - only basic configuration files exist. Implementation has not started.

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
- **LLM/AI SDK**: AI agent SDK for flexibility

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

### General Principles
- Read README.md for detailed feature specifications and requirements
- Follow ES module syntax (`import/export`, not `require()`)
- Use GitHub MCP Server for GitHub API (not generic HTTP clients)
- Keep integrations modular and pluggable
- Include tests when implementing features
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

## Version History

- **2025-11-18**: Initial CLAUDE.md created
- **2025-11-18**: Distilled to remove speculative content, focus on current state and generic guidelines
