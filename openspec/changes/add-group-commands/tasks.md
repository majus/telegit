# Implementation Tasks

## 1. Create Command Handlers Module
- [ ] 1.1 Create `src/services/telegram/commands.js` file
- [ ] 1.2 Implement `isGroupChat(ctx)` helper function
- [ ] 1.3 Implement `formatUptime(seconds)` helper for human-readable uptime
- [ ] 1.4 Implement `formatOperationsBreakdown(operations)` helper for emoji-based breakdown
- [ ] 1.5 Implement `gatherOperationStats(groupId)` async helper to collect statistics
- [ ] 1.6 Implement `createStartCommandHandler()` factory function
- [ ] 1.7 Implement `createUnlinkCommandHandler()` factory function
- [ ] 1.8 Implement `createUnlinkCallbackHandler()` factory for callback queries
- [ ] 1.9 Implement `createStatusCommandHandler()` factory function

## 2. Register Command Handlers
- [ ] 2.1 Add imports to `src/index.js` for command handler factories
- [ ] 2.2 Register `/start` command handler with `botInstance.command('start', ...)`
- [ ] 2.3 Register `/unlink` command handler with `botInstance.command('unlink', ...)`
- [ ] 2.4 Register `/status` command handler with `botInstance.command('status', ...)`
- [ ] 2.5 Register callback query handler for unlink confirmation with `botInstance.on('callback_query', ...)`

## 3. Update Message Filtering
- [ ] 3.1 Export `filterGroupMessage()` from `src/services/telegram/filters.js` for reuse in commands (if needed)
- [ ] 3.2 Verify commands are registered after middleware but before message handler

## 4. Testing
- [ ] 4.1 Create `test/unit/telegram/commands.test.js`
- [ ] 4.2 Write unit tests for `isGroupChat()` helper
- [ ] 4.3 Write unit tests for `formatUptime()` helper
- [ ] 4.4 Write unit tests for `formatOperationsBreakdown()` helper
- [ ] 4.5 Write unit tests for `/start` command handler (authenticated/unauthenticated/private chat)
- [ ] 4.6 Write unit tests for `/unlink` command handler (manager/non-manager/not linked)
- [ ] 4.7 Write unit tests for `/status` command handler (manager/non-manager/mocked stats)
- [ ] 4.8 Write unit tests for unlink callback handler (confirm/cancel)
- [ ] 4.9 Run `npm test` and verify all tests pass

## 5. Manual Verification
- [ ] 5.1 Test `/start` in whitelisted group (linked)
- [ ] 5.2 Test `/start` in whitelisted group (not linked) - verify setup triggered
- [ ] 5.3 Test `/start` in non-whitelisted group - verify whitelist error
- [ ] 5.4 Test `/start` in private chat - verify "group only" error
- [ ] 5.5 Test `/unlink` as manager in authenticated group - verify confirmation dialog
- [ ] 5.6 Test `/unlink` as non-manager - verify authorization error
- [ ] 5.7 Test `/unlink` in delisted group as manager - verify successful unlink
- [ ] 5.8 Test `/unlink` confirmation: click "Yes" - verify config deleted
- [ ] 5.9 Test `/unlink` confirmation: click "No" - verify cancelled
- [ ] 5.10 Test `/status` as manager - verify statistics and health displayed
- [ ] 5.11 Test `/status` as non-manager - verify authorization error
- [ ] 5.12 Test `/status` in non-whitelisted group - verify whitelist error

## 6. Documentation
- [ ] 6.1 Update README.md to mention available commands
- [ ] 6.2 Update CLAUDE.md if command handler pattern should be documented
