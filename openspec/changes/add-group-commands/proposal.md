# Change: Add Group Chat Commands

## Why

TeleGit currently has no explicit commands for users to check bot status, view usage statistics, or manage group configuration. Users must trigger the bot via mentions or hashtags, but cannot:
- View an introduction/help message on demand
- Check usage statistics for their group
- Unlink their group from GitHub (e.g., when access is removed from whitelist)

This creates friction for group managers who need visibility into bot operations and the ability to manage the GitHub integration.

## What Changes

Add three new slash commands for group chats only:

1. `/start` - Display bot introduction, capabilities, available commands, and GitHub link status
   - If group not linked: automatically trigger GitHub setup workflow
   - Respects whitelist access control

2. `/status` - Display usage statistics and connection health (manager-only)
   - Operations summary (total, by status, by type with emoji indicators)
   - Conversation cache statistics
   - Feedback queue count
   - Connection health for Database, LLM API, and GitHub MCP
   - Group info (repository, manager, created date) and system uptime

3. `/unlink` - Disconnect group from GitHub repository (manager-only, with confirmation)
   - Shows inline keyboard confirmation dialog (Yes/No buttons)
   - Deletes group configuration on confirmation
   - Works for non-whitelisted groups to enable opt-out

All commands are group-only (reject private messages) and use Telegraf's built-in command handlers.

## Impact

- **Affected specs**:
  - NEW: `group-commands` (commands handling)
  - MODIFIED: `message-filtering` (commands bypass trigger filtering)

- **Affected code**:
  - NEW: `src/services/telegram/commands.js` (command handlers and helpers)
  - MODIFIED: `src/index.js` (register command handlers)
  - USES: Existing repositories (`ConfigRepository`, `OperationsRepository`, `ConversationContextRepository`, `FeedbackRepository`)
  - USES: Existing health checks (`testConnection`, `validateLLMConnection`, `getSharedGitHubTools`)
  - USES: Existing auth functions (`isGroupAuthenticated`, `isGroupManager`, `getGitHubConfig`)
  - USES: Existing setup workflow (`sendAuthRequiredMessage`)

- **User experience**:
  - Improved discoverability (users can run `/start` to learn bot capabilities)
  - Group managers gain visibility into bot operations
  - Delisted groups can opt-out via `/unlink` without whitelist access

- **No breaking changes**: Commands are additive, existing trigger-based flow unchanged
