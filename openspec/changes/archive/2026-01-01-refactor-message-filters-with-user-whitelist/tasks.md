# Implementation Tasks

## 1. Configuration Layer
- [x] 1.1 Add `TELEGRAM_USER_IDS` to Zod schema in config/env.js (optional string field)
- [x] 1.2 Parse TELEGRAM_USER_IDS into integer array in loadConfig()
- [x] 1.3 Add allowedUserIds to telegram config object
- [x] 1.4 Update ParsedConfig type in src/types/config.d.ts

## 2. Filter Decoupling
- [x] 2.1 Remove getConfig() import from src/services/telegram/filters.js
- [x] 2.2 Update isFromAllowedChat() to remove config fallback (require explicit parameter)
- [x] 2.3 Add filterPrivateMessage() function for private message logic
- [x] 2.4 Update createFilterMiddleware() to handle private vs group messages
- [x] 2.5 Set ctx.state.isPrivateMessage flag for all private messages
- [x] 2.6 Set ctx.state.isGroupMessage flag for processed group messages

## 3. Private Message Handler
- [x] 3.1 Create src/services/telegram/private-message-handler.js
- [x] 3.2 Implement handlePrivateMessage() with whitelist/session checks
- [x] 3.3 Display "not authorized" message for non-whitelisted users
- [x] 3.4 Route whitelisted users to handleSetupMessage()
- [x] 3.5 Export createPrivateMessageHandler() factory

## 4. Bot Handler Registration
- [x] 4.1 Add imports: createFilterMiddleware, handlePrivateMessage, getSetupSession, cleanupExpiredSessions
- [x] 4.2 Remove old filterMessage import
- [x] 4.3 Update registerBotHandlers() signature to accept filterOptions parameter
- [x] 4.4 Replace inline filtering middleware with createFilterMiddleware()
- [x] 4.5 Update message handler to route by ctx.state flags (isPrivateMessage vs isGroupMessage)
- [x] 4.6 Update edited_message handler to skip private messages
- [x] 4.7 Build filterOptions in startApplication() from config
- [x] 4.8 Add session cleanup interval (every 5 minutes)

## 5. Type Definitions
- [x] 5.1 Add PrivateMessageFilterResult interface to src/types/bot.d.ts
- [x] 5.2 Update FilterResult interface if needed

## 6. Testing
- [x] 6.1 Test config parsing with TELEGRAM_USER_IDS set
- [x] 6.2 Test config parsing with TELEGRAM_USER_IDS empty
- [x] 6.3 Test group message with mention + both whitelists
- [x] 6.4 Test group message filtered by user whitelist
- [x] 6.5 Test group message filtered by chat whitelist
- [x] 6.6 Test private message from whitelisted user with session
- [x] 6.7 Test private message from whitelisted user without session
- [x] 6.8 Test private message from non-whitelisted user (should show error)
- [x] 6.9 Test session cleanup removes expired sessions
- [x] 6.10 Test backward compatibility (empty TELEGRAM_USER_IDS allows all)

## 7. Documentation
- [x] 7.1 Update README.md with TELEGRAM_USER_IDS environment variable
- [x] 7.2 Update CLAUDE.md if filter usage patterns changed
- [x] 7.3 Add inline JSDoc comments to new functions

## 8. Cleanup
- [x] 8.1 Verify src/services/telegram/whitelist.js is not used (can be removed)
- [x] 8.2 Remove any dead code from refactoring
