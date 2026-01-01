# Change: Refactor Message Filters with User Whitelist Support

## Why

The current message filtering system has several architectural issues that prevent proper handling of private messages and setup workflows:

1. **Tight coupling**: `isFromAllowedChat()` directly calls `getConfig()` (filters.js:105), violating separation of concerns
2. **Unused middleware factory**: `createFilterMiddleware()` exists but is never used; code uses direct `filterMessage()` calls instead
3. **Missing user whitelist**: `allowedUserIds` parameter exists but is never populated from environment variables
4. **Private message problem**: Private messages are filtered by group chat rules, preventing GitHub setup workflow from functioning
5. **No setup handler registration**: `handleSetupMessage()` implementation exists (auth-setup.js) but is never wired into bot handlers

This prevents users from completing GitHub authentication setup via private messages, breaking a critical onboarding workflow.

## What Changes

- **Decouple configuration**: Extract config loading outside filters; pass as explicit parameters to middleware
- **Utilize middleware factory**: Replace inline `filterMessage()` calls with `createFilterMiddleware()`
- **Add user whitelist support**: Parse `TELEGRAM_USER_IDS` environment variable and integrate into filtering logic
- **Separate private vs group logic**: Private messages route to setup handler, group messages route to AI workflow
- **User-friendly error messages**: Non-whitelisted users in private chats receive "not authorized" message instead of silence
- **Dual whitelist for groups**: Group messages filtered by BOTH chat whitelist AND user whitelist

**BREAKING**: Group messages now require BOTH chat whitelist AND user whitelist to pass (if user whitelist is configured)

## Impact

**Affected capabilities:**
- `message-filtering` - Core filtering logic refactored, user whitelist added
- `private-message-handling` - New capability for GitHub setup workflow routing
- `configuration` - Environment variable parsing extended

**Affected code:**
- `config/env.js` - Add TELEGRAM_USER_IDS parsing
- `src/services/telegram/filters.js` - Decouple config, add private message filter
- `src/services/telegram/private-message-handler.js` - NEW file for routing logic
- `src/index.js` - Replace inline filtering with middleware factory
- `src/types/config.d.ts` - Add allowedUserIds type
- `src/types/bot.d.ts` - Add PrivateMessageFilterResult type

**Migration path:**
- Existing deployments: Set `TELEGRAM_USER_IDS=""` (empty) to allow all users (backward compatible)
- To enforce user whitelist: Set `TELEGRAM_USER_IDS="123456,789012"` with comma-separated user IDs
