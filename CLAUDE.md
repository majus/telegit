# CLAUDE.md - AI Assistant Guide for TeleGit

This document provides comprehensive guidance for AI assistants working on the TeleGit codebase.

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
└── CLAUDE.md            # This file - AI assistant guide
```

**Current State**: Early stage - project is just being set up. Most code files need to be created.

## Technical Stack

### Core Technologies
- **Language**: JavaScript (ES modules - `"type": "module"` in package.json)
- **TypeScript**: Only for type definitions, NOT for implementation
- **Runtime**: Node.js >= 24.0.0 (specified in `.nvm`)
- **Testing**: Vitest
- **Deployment**: Docker with Dokploy

### Key Dependencies
- **Telegraf**: NPM library for Telegram Bot API integration
- **Supabase**: Database backend
- **GitHub MCP Server**: For GitHub API integration (NOT generic HTTP client)
- **LLM/AI SDK**: Popular AI agent SDK must be integrated for flexibility

### Integrations
- Telegram Bot API: https://core.telegram.org/bots/api
- GitHub MCP server: https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md

## Development Conventions

### Code Style
- **JavaScript Only**: Implementation files should be `.js` (ES modules)
- **TypeScript**: Only for `.d.ts` type definition files
- **Module System**: ES modules (`import/export`, not `require()`)
- **Node Version**: Always ensure compatibility with Node.js 24+

### Architecture Principles

1. **Pluggable Design**
   - GitHub integration must be a pluggable module with well-defined, generic API
   - Design for future support of other task management systems (ClickUp, Jira, Todoist)
   - Separate concerns: message parsing, intent classification, action execution

2. **GitHub Integration**
   - MUST use GitHub MCP server (official integration)
   - DO NOT use generic HTTP API clients for GitHub
   - Implement as a module that can be replicated for other platforms

3. **LLM Integration**
   - Use a popular AI agent SDK for flexibility and extensibility
   - Design prompts for intent extraction and classification
   - Support for message context (conversation threads)

### Testing Requirements

**LLM Evaluation Framework** (Essential for MVP):
- Test suite with example inputs (messages) and expected outputs
- Automated evaluation using LLM-as-judge to score outputs
- Integration with CI/CD to catch regressions
- Performance baselines for optimization

**Test Structure**:
- Use Vitest as the testing framework
- Include message classification tests
- Include GitHub operation tests
- Document expected behaviors with examples

## Feature Implementation Guide

### Core Features to Implement

1. **Message Triggering**
   - Bot mention detection (e.g., `@TeleGitBot`)
   - Hashtag detection (e.g., `#bug`, `#task`, `#idea`)
   - Ignore messages without mentions or hashtags (cost optimization)

2. **Bot Workflow**
   ```
   Message received → 👀 (Analyzing)
                   → Parse & classify with LLM
                   → 🤔 (Processing)
                   → Perform GitHub operation via MCP
                   → Status reaction:
                      - 👾 bug recorded
                      - 🫡 task issued
                      - 🦄 idea logged
                      - 😵‍💫 error occurred
                   → Post feedback message (auto-delete after 10 min)
   ```

3. **Reaction-based Controls**
   - 👎 on feedback message: Undo action (close/revert issue)
   - 👍 on feedback message: Dismiss immediately

4. **Conversation Context**
   - Detect if message is a reply
   - Collect all messages up to original message
   - Use full conversation as context for analysis

5. **Hashtag Categorization**
   - Extract hashtags from messages
   - Map to GitHub issue labels
   - Support: `#todo`, `#plan`, `#idea`, `#bug`, `#task`, `#epic`, etc.

6. **Image Attachments**
   - Support direct Telegram file links
   - Embed in GitHub issues
   - GitHub converts to static CDN URLs (safe for public sharing)

### GitHub Operations to Support
- Create new issues
- Search for existing issues
- Update issue content
- Update issue status
- Close/revert issues (for undo functionality)

### Access Control
- Whitelist Telegram groups (via environment variables)
- Whitelist user accounts (via environment variables)
- Implement group-to-repository mapping

### Configuration Management

**Per Telegram Group**:
- GitHub Personal Access Token (PAT) with `repo` scope
- Repository name (format: `owner/repo-name`)
- Configuration via private message with bot (first user becomes manager)

**Bot Manager Operations**:
- Update repository configuration
- Unlink bot from GitHub repository for a channel

## Environment Variables

Expected environment variables (to be defined during implementation):
- Telegram Bot Token
- LLM API credentials
- Supabase connection details
- GitHub whitelisting configuration
- Group-to-repository mappings

## File Organization Recommendations

Suggested structure for implementation:

```
telegit/
├── src/
│   ├── bot/              # Telegram bot logic
│   │   ├── handlers/     # Message and reaction handlers
│   │   ├── middleware/   # Authentication, whitelisting
│   │   └── reactions.js  # Reaction management
│   ├── llm/              # LLM integration
│   │   ├── classifier.js # Intent classification
│   │   ├── parser.js     # Message parsing
│   │   └── prompts/      # LLM prompt templates
│   ├── integrations/     # External integrations
│   │   ├── github/       # GitHub MCP integration
│   │   └── base/         # Base classes for pluggable integrations
│   ├── db/               # Supabase database logic
│   │   ├── config.js     # Group configurations
│   │   └── schema.sql    # Database schema
│   ├── utils/            # Utility functions
│   └── index.js          # Main entry point
├── tests/
│   ├── evaluation/       # LLM evaluation framework
│   │   ├── fixtures/     # Test messages and expectations
│   │   └── judge.js      # LLM-as-judge implementation
│   ├── unit/             # Unit tests
│   └── integration/      # Integration tests
├── docker/
│   └── Dockerfile        # Docker configuration
├── .env.example          # Environment variable template
├── .gitignore
├── package.json
├── vitest.config.js      # Vitest configuration
├── README.md
└── CLAUDE.md
```

## Implementation Priorities

### MVP Requirements
1. ✅ Message triggering (mentions & hashtags)
2. ✅ LLM-powered intent classification
3. ✅ GitHub MCP integration for basic issue operations
4. ✅ Emoji status indicators
5. ✅ Feedback messages with auto-deletion
6. ✅ Reaction-based undo (👎)
7. ✅ Image attachment support
8. ✅ **LLM evaluation framework** (Essential!)
9. ✅ GitHub PAT authentication
10. ✅ Per-group configuration via private messages

### Future Enhancements (Post-MVP)
- OAuth flow for GitHub authentication
- Multi-repository support per group
- Rate limiting and cost controls
- Web dashboard for configuration and analytics
- Support for additional message types (polls, documents)
- Custom emoji reactions per team
- Additional task management integrations (ClickUp, Jira, Todoist)

## Git Workflow

### Branch Naming
- Use descriptive branch names
- Current branch: `claude/claude-md-mi49jrz6j27c0aje-01M3H4i2d2NgdS9ArvpBWbfD`
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

### When Implementing Features

1. **Read README.md First**: Contains comprehensive feature descriptions and requirements
2. **Follow ES Module Syntax**: Use `import/export`, not `require()`
3. **Use GitHub MCP Server**: Don't implement custom GitHub HTTP clients
4. **Maintain Pluggable Architecture**: Keep integrations modular and generic
5. **Include Tests**: Especially LLM evaluation tests
6. **Document Decisions**: Add comments for non-obvious logic
7. **Consider Future Extensibility**: Design for additional platforms

### When Adding Dependencies

1. Update `package.json`
2. Verify compatibility with Node.js 24+
3. Prefer well-maintained libraries
4. Document why the dependency is needed

### When Modifying Configuration

1. Update `.env.example` if environment variables change
2. Document configuration options
3. Maintain backward compatibility when possible

### Code Quality Checklist

- [ ] ES modules syntax used
- [ ] Compatible with Node.js 24+
- [ ] Tests included (especially for LLM features)
- [ ] Error handling implemented
- [ ] Emojis used correctly for status indicators
- [ ] GitHub MCP server used (not HTTP client)
- [ ] Pluggable architecture maintained
- [ ] Comments added for complex logic
- [ ] Environment variables documented

## Common Pitfalls to Avoid

1. ❌ Don't use TypeScript for implementation (only for `.d.ts` files)
2. ❌ Don't use generic HTTP clients for GitHub API
3. ❌ Don't couple GitHub integration tightly (must be pluggable)
4. ❌ Don't skip LLM evaluation framework (it's essential for MVP)
5. ❌ Don't make bot disruptive (follow minimalist philosophy)
6. ❌ Don't ignore conversation context in message analysis
7. ❌ Don't hardcode configurations (use environment variables)
8. ❌ Don't forget auto-deletion of feedback messages (10 minutes)

## Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Telegraf Library](https://www.npmjs.com/package/telegraf)
- [GitHub MCP Server](https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md)
- [Dokploy Documentation](https://docs.dokploy.com/docs/core)
- [Vitest Documentation](https://vitest.dev/)
- Project README.md for detailed feature specifications

## Questions or Clarifications

When you encounter ambiguity:
1. Check README.md for detailed specifications
2. Prioritize minimalist, non-disruptive design
3. Follow the pluggable architecture principle
4. Ask for clarification if requirements conflict
5. Default to optimistic actions with easy undo

## Version History

- **2025-11-18**: Initial CLAUDE.md created - Repository analysis and documentation
