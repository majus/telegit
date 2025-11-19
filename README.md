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
- PostgreSQL

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
   - 😵‍💫 - error occurred
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
ALLOWED_GROUPS="-123456789,-987654321"  # Comma-separated group IDs (negative numbers)
ALLOWED_USERS="123456789,987654321"     # Comma-separated user IDs (positive numbers)
```

If not set, all groups/users are allowed. Both whitelists can be combined.

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

## LLM Evaluation Framework

**Essential for MVP**: A built-in evaluation system ensures bot behavior remains predictable and measurable as prompts and models evolve.

**Implementation:**
- Test suite with example inputs (messages) and expected outputs (intent classification, GitHub operations)
- Automated evaluation using LLM-as-judge to score actual outputs against expectations
- Integration with codebase to stay synchronized with changes
- CI/CD integration to catch regressions before deployment

**Benefits:**
- Rapid experimentation with different LLM models and prompts
- Confidence in changes through automated testing
- Documented examples of expected behavior
- Performance baselines for optimization

## Future Plans

The bot is designed with extensibility in mind. It should later be possible to use other targets for task management in addition to GitHub, so the GitHub integration must be implemented as a pluggable module with well-defined, sufficiently generic API which is easy to replicate for other potential targets (ClickUp, Jira, Todoist, etc).

Additional future enhancements:
- OAuth flow for GitHub authentication (more secure than PATs)
- Multi-repository support per group
- Rate limiting and cost controls
- Web dashboard for configuration and analytics
- Support for additional message types (polls, documents, etc.)
- Custom emoji reactions per team preferences