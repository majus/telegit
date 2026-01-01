# Implementation Tasks

## 1. Configuration Layer
- [ ] 1.1 Add `TELEGRAM_USER_IDS` to Zod schema in config/env.js (optional string field)
- [ ] 1.2 Parse TELEGRAM_USER_IDS into integer array in loadConfig()
- [ ] 1.3 Add allowedUserIds to telegram config object
- [ ] 1.4 Update ParsedConfig type in src/types/config.d.ts

## 2. Filter Decoupling
- [ ] 2.1 Remove getConfig() import from src/services/telegram/filters.js
- [ ] 2.2 Update isFromAllowedChat() to remove config fallback (require explicit parameter)
- [ ] 2.3 Add filterPrivateMessage() function for private message logic
- [ ] 2.4 Update createFilterMiddleware() to handle private vs group messages
- [ ] 2.5 Set ctx.state.isPrivateMessage flag for all private messages
- [ ] 2.6 Set ctx.state.isGroupMessage flag for processed group messages

## 3. Private Message Handler
- [ ] 3.1 Create src/services/telegram/private-message-handler.js
- [ ] 3.2 Implement handlePrivateMessage() with whitelist/session checks
- [ ] 3.3 Display "not authorized" message for non-whitelisted users
- [ ] 3.4 Route whitelisted users to handleSetupMessage()
- [ ] 3.5 Export createPrivateMessageHandler() factory

## 4. Bot Handler Registration
- [ ] 4.1 Add imports: createFilterMiddleware, handlePrivateMessage, getSetupSession, cleanupExpiredSessions
- [ ] 4.2 Remove old filterMessage import
- [ ] 4.3 Update registerBotHandlers() signature to accept filterOptions parameter
- [ ] 4.4 Replace inline filtering middleware with createFilterMiddleware()
- [ ] 4.5 Update message handler to route by ctx.state flags (isPrivateMessage vs isGroupMessage)
- [ ] 4.6 Update edited_message handler to skip private messages
- [ ] 4.7 Build filterOptions in startApplication() from config
- [ ] 4.8 Add session cleanup interval (every 5 minutes)

## 5. Type Definitions
- [ ] 5.1 Add PrivateMessageFilterResult interface to src/types/bot.d.ts
- [ ] 5.2 Update FilterResult interface if needed

## 6. Testing
- [ ] 6.1 Test config parsing with TELEGRAM_USER_IDS set
- [ ] 6.2 Test config parsing with TELEGRAM_USER_IDS empty
- [ ] 6.3 Test group message with mention + both whitelists
- [ ] 6.4 Test group message filtered by user whitelist
- [ ] 6.5 Test group message filtered by chat whitelist
- [ ] 6.6 Test private message from whitelisted user with session
- [ ] 6.7 Test private message from whitelisted user without session
- [ ] 6.8 Test private message from non-whitelisted user (should show error)
- [ ] 6.9 Test session cleanup removes expired sessions
- [ ] 6.10 Test backward compatibility (empty TELEGRAM_USER_IDS allows all)

## 7. Documentation
- [ ] 7.1 Update README.md with TELEGRAM_USER_IDS environment variable
- [ ] 7.2 Update CLAUDE.md if filter usage patterns changed
- [ ] 7.3 Add inline JSDoc comments to new functions

## 8. Cleanup
- [ ] 8.1 Verify src/services/telegram/whitelist.js is not used (can be removed)
- [ ] 8.2 Remove any dead code from refactoring
