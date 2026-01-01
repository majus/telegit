# Project Context

## Purpose

TeleGit is a minimalist AI-powered Telegram bot that converts chat messages into GitHub issue actions. The bot uses natural language processing (via LLM API) to analyze, classify, and sync messages to GitHub Issues, streamlining idea capture and bug reporting from team Telegram chats.

**Core Philosophy:**
- **Minimalist & Non-disruptive**: Use emojis for status, temporary feedback messages (auto-deleted after 10 minutes)
- **Optimistic Actions**: Perform actions without constant confirmation, but allow easy correction via reaction-based controls
- **Chat-first Workflow**: Telegram group chat as single entry point for tasks, ideas, and bug reports

## Tech Stack

- **Language**: JavaScript (ES modules)
- **Runtime**: Node.js >= 22.0.0
- **Database**: PostgreSQL (using `pg` NPM library)
- **Testing**: Vitest
- **Prompt Testing**: Promptfoo (LLM evaluation framework)
- **Deployment**: Docker with Dokploy
- **Bot Framework**: Telegraf (Telegram Bot API integration)
- **AI/LLM**: LangChain stack (@langchain/core, @langchain/openai, @langchain/langgraph, @langchain/mcp-adapters)
- **GitHub Integration**: GitHub MCP server (via MCP protocol)
- **Monitoring**: Pino logger, Prometheus metrics
- **TypeScript**: Only for type definitions (`.d.ts` files), NOT for implementation

## Project Conventions

### Code Style

- **JavaScript Only**: Implementation files must be `.js` (ES modules)
- **TypeScript**: Only for `.d.ts` type definition files - do not use "export" in type definitions
- **Module System**: ES modules (`import/export`, not `require()`)
- **No Blank Lines**: Do NOT insert blank lines in function bodies for visual separation
- **Comments**: Add comments only for non-obvious logic
- **Node Version**: Always ensure compatibility with Node.js 22+

### Architecture Patterns

- **Modular Integrations**: Keep external integrations pluggable with well-defined, generic APIs
- **GitHub as a Module**: GitHub integration implemented as a pluggable module to support future targets (ClickUp, Jira, Todoist)
- **LangGraph Workflow**: AI processing uses LangGraph for orchestrating workflow nodes (analyze → format → store → notify → error)
- **Repository Pattern**: Database access through dedicated repository classes in `src/database/repositories/`
- **MCP Protocol**: Use MCP (Model Context Protocol) for external tool integrations, not generic HTTP clients
- **Encryption**: AES-256-GCM encryption for sensitive data at rest (GitHub PATs)

### Testing Strategy

- **Test Framework**: Vitest for all unit and integration tests
- **LLM Evaluation**: Promptfoo for testing LLM behavior, prompts, and intent classification
- **Test Organization**:
  - `test/unit/` - Unit tests for individual components
  - `test/integration/` - Integration tests for workflows
  - `test/promptfoo/` - LLM evaluation test suites
  - `test/mocks/` - Mock data generators
  - `test/helpers/` - Test utilities
- **Include Tests**: Always include tests when implementing features
- **Regression Prevention**: LLM evaluation framework catches prompt/model regressions

### Git Workflow

- Use descriptive branch names
- Follow conventional commit message format
- Reference issues when applicable
- Main branch: `main`

## Domain Context

**Telegram Bot Workflow:**
1. Message triggers bot if it contains mentions (`@TeleGitBot`) or hashtags (`#bug`, `#task`, `#idea`)
2. Bot reacts with emoji status indicators (👀 analyzing → 🤔 processing → 👾/🫡/🦄 success or 😱 error)
3. LLM classifies intent and extracts structured data
4. GitHub MCP server creates/updates/deletes issues
5. Feedback message posted with links (auto-deleted after 10 minutes)
6. Users can react: 👎 to undo, 👍 to dismiss

**Conversation Context**: Bot checks if message is a reply and collects full conversation thread for context.

**Access Control**: Per-user GitHub authentication with encrypted PATs, optional group/user whitelists.

**Security**: Input sanitization, encrypted credentials, least-privilege tokens.

## Important Constraints

- **JavaScript Only**: No TypeScript implementation files (only `.d.ts` type definitions)
- **Node.js Version**: Must support Node.js >= 22.0.0 (specified in `.nvm`)
- **ES Modules**: All code uses ES module syntax (`"type": "module"` in package.json)
- **MCP Integration**: Must use GitHub MCP server for GitHub API, not generic HTTP clients
- **No Hardcoding**: Use environment variables for all configuration
- **Cost Awareness**: Messages without mentions/hashtags are ignored to reduce LLM costs
- **Auto-deletion**: Feedback messages auto-delete after 10 minutes to avoid chat clutter

## External Dependencies

- **Telegram Bot API**: Core messaging platform (https://core.telegram.org/bots/api)
- **GitHub MCP Server**: GitHub integration via MCP protocol (https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md)
- **LLM Provider**: OpenAI API (via LangChain) for intent classification and message analysis
- **PostgreSQL**: Database for storing user configs, operations, feedback tracking, and conversation context
- **Prometheus**: Metrics collection endpoint at `/api/metrics`
- **Docker/Dokploy**: Deployment platform (https://docs.dokploy.com/docs/core)
