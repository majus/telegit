## Executive Summary

TeleGit - a minimalist AI-powered Telegram bot that turns simple chat messages into actions on issues in GitHub repository. Using natural language processing (via LLM API), messages are analyzed, classified, categorized, and synced to GitHub Issues streamlining idea capture and bug reporting from the team's Telegram chat, all with a quick feedback loop.

The main idea is for the bot to be as non-disruptive as possible. Emojis indicate processing status, while temporary feedback messages (auto-deleted after 10 minutes) provide actionable links and confirmations without cluttering the chat long-term.

The bot performs actions optimistically without requiring constant user confirmation, but allows easy correction through reaction-based controls.

## Technical Stack

- JavaScript
- TypeScript (only for type definitions)
- Node.js >= 22.0.0
- Vitest
- Docker
- [Dokploy](https://docs.dokploy.com/docs/core)
- [Telegraf](https://www.npmjs.com/package/telegraf) NPM library
- MongoDB

Some popular AI agent SDK must be integrated for flexibility and potential extendability of the AI workflow. The GitHub API must be integrated via MVP tool rather than via generic HTTP API client.

## Integrations

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [GitHub MCP server](https://raw.githubusercontent.com/github/github-mcp-server/refs/heads/main/README.md)

## Features

- Chat-first workflow: Use Telegram group chat as the single entry point for all tasks, ideas, and bug reports.
- LLM-powered intent extraction: Message content is analyzed to determine intent and category.
- Automated GitHub sync: Manages GitHub issues in your configured repository using GitHub MCP server.
- Reaction-based controls: Users can undo actions with 👎 or dismiss feedback with 👍.
- Image attachment support: Direct Telegram file links are embedded in issues, which GitHub backend converts to static CDN URLs.
- LLM evaluation framework: Built-in testing system ensures bot behavior remains predictable and allows experimentation with models and prompts.

## How It Works

**Triggering the bot:**
Write a message in Telegram group chat that either:
- Mentions the bot explicitly (e.g., `@TeleGitBot`), OR
- Contains hashtags (e.g., `#bug`, `#task`, `#idea`)

Messages without mentions or hashtags are ignored to reduce unnecessary LLM usage and costs.

**Bot workflow:**
1. Indicate the start of analysis as a reaction on your message - 👀 (Analysing).
2. Parse and classify the message using an LLM API call.
3. Indicate the successful parsing of user's intent and performing an operation as a reaction on the original message - 🤔 (Processing). If the intent was not defined, throw an error and handle it normally.
4. Perform operation on GitHub issues via official GitHub MCP server.
5. Indicate the action made as a reaction on the original message:
   - 👾 - bug recorded
   - 🫡 - task issued
   - 🦄 - idea logged
   - 😱 - error occurred
6. Post a feedback message with:
   - Link to the created/updated/deleted GitHub issue, OR
   - Error description if something went wrong
   - This message auto-deletes after 10 minutes

**Reaction-based controls:**
After the bot posts its feedback message, you can react to it:
- 👎 - Undo the last action (closes/reverts the created/updated issue)
- 👍 - Dismiss the feedback message immediately (without waiting 10 minutes)

**Conversation history context**: 
When received a message to analyse, the bot should check if it's a reply to another message in the chat, and if so collect all messages up to the original message and use the full conversation as a context for analysis.

**Categorization with hashtags:**
You may include hashtags to categorize your intent more explicitly, e.g., `#todo`, `#plan`, `#idea`, `#bug`, `#task`, `#epic`, etc. These are selectively added to GitHub issues as labels when created by the bot.

**TeleGit can also:**
- Search for existing GitHub issues
- Update existing issues content or statuses
- Include image attachments from messages - direct Telegram file links are embedded, which GitHub backend converts to static GitHub CDN URLs (safe for public sharing, unlike original Telegram URLs containing the bot's private token)

## Access Control

Restrict bot access using environment variables:

```bash
# Chat/Group Whitelist (required)
TELEGRAM_CHAT_IDS="-123456789,-987654321"  # Comma-separated group IDs (negative numbers)

# User Whitelist (optional)
TELEGRAM_USER_IDS="123456789,987654321"    # Comma-separated user IDs (positive numbers)
```

**Chat Whitelist (`TELEGRAM_CHAT_IDS`)**: Required. Specifies which Telegram groups/chats the bot will respond to.

**User Whitelist (`TELEGRAM_USER_IDS`)**: Optional. When set, applies user-level access control:
- **Group messages**: User must be in BOTH chat whitelist AND user whitelist
- **Private messages**: User must be in user whitelist to complete GitHub setup
- **If not set**: All users are allowed (backward compatible)

Both whitelists work together to provide fine-grained access control. This dual-whitelist approach prevents unauthorized users from using the bot even in whitelisted groups.

## Security

**Token Encryption:** GitHub PATs encrypted at rest using AES-256-GCM. Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="your-64-character-hex-string"
```

**Input Sanitization:** All messages sanitized to prevent XSS/injection attacks. Removes script tags, dangerous HTML/attributes, and invalid URLs while preserving markdown.

**Best Practices:** Use least-privilege GitHub PATs (`repo` scope), whitelist authorized groups/users, never commit `.env` files, rotate credentials periodically, and keep dependencies updated.

## GitHub Authentication

**Per-User Authentication:** Each user authenticates with their own GitHub Personal Access Token (PAT).

When a user first triggers the bot in a Telegram group, they'll be prompted to:
1. Provide their GitHub repository URL (e.g., `https://github.com/owner/repo-name`)
2. Provide their GitHub PAT (with `repo` scope)

The bot securely stores the encrypted PAT (using AES-256-GCM encryption) and associates it with the user and group. This approach ensures:
- Users only create issues in repositories they have access to
- No shared credentials across users
- Proper attribution of GitHub actions to individual users
- Enhanced security through encryption of stored credentials

## Testing

TeleGit uses a comprehensive two-tier testing approach:

### Unit Tests (Vitest)

Fast, offline tests for application logic without API calls:

```bash
npm test              # Run all unit tests (< 10 seconds)
npm run test:coverage # With coverage report
```

**What's tested:**
- Input validation and error handling
- Utility functions (hashtag extraction, title generation, context formatting)
- Database operations (with MongoDB Memory Server)
- Message queue (rate limiting, retries, graceful shutdown)
- Encryption (AES-256-GCM)

**No API keys required** - unit tests use mocks and run completely offline.

### LLM Evaluations (Promptfoo)

Comprehensive AI behavior validation with 27+ test scenarios:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-proj-your-key-here

# Run evaluations
npx promptfoo eval -c test/promptfoo/intent-classification.yaml
```

**What's tested:**
- Intent classification accuracy (bug, task, idea detection)
- Entity extraction (hashtags, mentions, issue numbers)
- Context handling and conversation awareness
- Edge cases (long messages, special characters)
- Model comparison (GPT-4 vs GPT-3.5)

**Requires real OpenAI API key** - tests actual LLM behavior and prompt effectiveness.

### Documentation

- **[TESTING.md](./TESTING.md)** - Unit testing guide and best practices
- **[EVALUATION.md](./EVALUATION.md)** - LLM evaluation with Promptfoo

**Benefits:**
- Rapid development with fast, offline unit tests
- Confidence in LLM behavior through systematic evaluation
- Prevention of regressions in prompts and models
- Clear separation between application logic and AI behavior

## Monitoring & Observability

TeleGit includes comprehensive monitoring and observability features for production deployments:

**Structured Logging:**
- JSON-formatted logs using Pino logger
- Automatic redaction of sensitive data (tokens, passwords, API keys)
- Configurable log levels (debug, info, warn, error, fatal)
- Environment: `LOG_LEVEL=info` (default)

**Metrics Collection:**
- Prometheus-compatible metrics endpoint at `/api/metrics`
- Message processing metrics (throughput, duration, errors)
- External API metrics (GitHub, LLM token usage)
- Database query performance
- System resources (CPU, memory)

**Health Checks:**
- `/api/health` - Comprehensive health status of all dependencies
- `/api/ready` - Kubernetes readiness probe
- `/api/live` - Kubernetes liveness probe
- Status levels: healthy, degraded, critical

**Alerting:**
- Pre-configured Prometheus alerting rules
- Alerts for high error rates, queue backlogs, slow processing
- Integration with Alertmanager for notifications
- Configuration files in `config/monitoring/`

**Quick Start:**
```bash
# View metrics
curl http://localhost:3000/api/metrics

# Check health
curl http://localhost:3000/api/health
```

For detailed monitoring setup, deployment guides, and Grafana dashboards, see [`config/monitoring/README.md`](config/monitoring/README.md).

## Future Plans

The bot is designed with extensibility in mind. It should later be possible to use other targets for task management in addition to GitHub, so the GitHub integration must be implemented as a pluggable module with well-defined, sufficiently generic API which is easy to replicate for other potential targets (ClickUp, Jira, Todoist, etc).

Additional future enhancements:
- OAuth flow for GitHub authentication (more secure than PATs)
- Multi-repository support per group
- Rate limiting and cost controls
- Web dashboard for configuration and analytics
- Support for additional message types (polls, documents, etc.)
- Custom emoji reactions per team preferences