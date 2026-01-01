# Design Document: Message Filter Refactoring

## Context

The TeleGit bot currently has a partially implemented authentication setup workflow where users provide GitHub credentials via private messages. However, private messages are incorrectly filtered by group chat whitelist rules, preventing this flow from working. Additionally, the filter system is tightly coupled to configuration loading, making it difficult to test and maintain.

**Stakeholders:**
- Bot users needing to complete GitHub setup
- Team members maintaining filter logic
- DevOps configuring access control

**Constraints:**
- Must maintain backward compatibility for existing group message workflows
- Cannot break existing deployments without opt-in configuration
- Must preserve existing session management (in-memory for MVP)
- JavaScript-only implementation (no TypeScript except .d.ts files)

## Goals / Non-Goals

**Goals:**
- Enable private message setup workflow by routing private messages to auth-setup handler
- Decouple configuration from filter logic for better testability
- Add user-level access control to prevent unauthorized bot usage
- Utilize existing `createFilterMiddleware()` factory instead of ad-hoc inline filtering
- Provide clear error messages to unauthorized users

**Non-Goals:**
- Migrate session storage to MongoDB (keep in-memory for MVP)
- Change group message workflow or AI processing logic
- Modify GitHub authentication mechanism itself
- Add OAuth support (separate future work)
- Change auto-deletion behavior or emoji reactions

## Decisions

### Decision 1: Dual Whitelist for Group Messages

**What:** Group messages must pass BOTH chat whitelist (`TELEGRAM_CHAT_IDS`) AND user whitelist (`TELEGRAM_USER_IDS`) if user whitelist is configured.

**Why:**
- Prevents unauthorized users from using the bot even in whitelisted groups
- Provides finer-grained access control for security-sensitive deployments
- Consistent with private message whitelist behavior

**Alternatives considered:**
- OR logic (either chat OR user whitelisted) → Rejected: Weakens security, allows unauthorized users in whitelisted chats
- Separate env vars for group vs private → Rejected: Adds complexity, most deployments want consistent user whitelist

**Breaking change:** Yes, but mitigated by making `TELEGRAM_USER_IDS` optional (empty = allow all users)

### Decision 2: Always Route Private Messages to Handler

**What:** Private messages always pass through middleware to handler, which decides response based on whitelist/session status.

**Why:**
- Allows displaying error messages to non-whitelisted users
- Simplifies middleware logic (no silent drops)
- Enables better observability (all private messages logged)

**Alternatives considered:**
- Silent drop in middleware → Rejected: Poor UX, users don't know why bot isn't responding
- Generic error in middleware → Rejected: Handler has more context for helpful messages

### Decision 3: Explicit Configuration Passing

**What:** Remove `getConfig()` calls from filters.js; require config to be passed explicitly as function parameters.

**Why:**
- Enables testing without global config state
- Makes dependencies explicit
- Follows dependency injection pattern
- Allows different filter configurations in different contexts

**Alternatives considered:**
- Keep config access in filters → Rejected: Tight coupling makes testing difficult
- Use dependency injection container → Rejected: Over-engineering for simple use case

### Decision 4: State Flags for Message Routing

**What:** Middleware sets `ctx.state.isPrivateMessage` or `ctx.state.isGroupMessage` flags; handler routes based on these flags.

**Why:**
- Single source of truth for message classification
- Avoids re-checking chat type in multiple places
- Makes routing logic clear and testable

**Alternatives considered:**
- Check chat type in each handler → Rejected: Duplicates logic, error-prone
- Use Telegraf's built-in routing → Rejected: Doesn't support our whitelist requirements

## Architecture

### Data Flow

```
Environment Variables
  ↓
config/env.js (loadConfig)
  ↓
src/index.js (startApplication)
  ├─→ filterOptions = { allowedChatIds, allowedUserIds, hasActiveSession }
  ↓
registerBotHandlers(bot, filterOptions)
  ├─→ createFilterMiddleware(filterOptions)
  │   ├─→ Private message? → filterPrivateMessage()
  │   │   └─→ Set isPrivateMessage flag, call next()
  │   └─→ Group message? → filterMessage()
  │       └─→ Set isGroupMessage flag if passes, call next()
  ↓
Message Handler (on 'message')
  ├─→ isPrivateMessage? → handlePrivateMessage()
  │   ├─→ Not whitelisted → Send "not authorized"
  │   ├─→ Whitelisted + session → handleSetupMessage()
  │   └─→ Whitelisted + no session → handleSetupMessage() (guidance)
  └─→ isGroupMessage? → createMessageHandler() → AI workflow
```

### Component Relationships

**config/env.js**
- Parses `TELEGRAM_USER_IDS` environment variable
- Exports structured config object
- No dependencies on filter logic

**src/services/telegram/filters.js**
- Pure functions for filtering logic
- No config imports (dependencies passed as parameters)
- Exports: `filterMessage()`, `filterPrivateMessage()`, `createFilterMiddleware()`

**src/services/telegram/private-message-handler.js** (NEW)
- Imports: `getSetupSession`, `handleSetupMessage`, `filterPrivateMessage`
- Routes private messages based on whitelist/session
- Exports: `handlePrivateMessage()`, `createPrivateMessageHandler()`

**src/index.js**
- Orchestrates middleware registration
- Builds filterOptions from config
- Registers message routing logic
- Sets up session cleanup interval

## Risks / Trade-offs

### Risk: Breaking Change for User Whitelist

**Description:** Existing deployments without `TELEGRAM_USER_IDS` will continue working, but setting it enables a new filter that could block previously allowed users.

**Mitigation:**
- Make `TELEGRAM_USER_IDS` optional (empty string = allow all users)
- Document clearly in README.md and migration notes
- Log warnings when messages are filtered by user whitelist
- Include in release notes as a BREAKING change

**Likelihood:** Medium (users may configure incorrectly)
**Impact:** High (blocks legitimate users)

### Risk: Session Loss on Bot Restart

**Description:** In-memory session storage means setup sessions are lost if bot restarts, forcing users to start over.

**Mitigation:**
- Document limitation clearly
- 30-minute session timeout is reasonable for one-time setup
- Future enhancement can migrate to MongoDB if needed
- Session cleanup prevents memory leaks

**Likelihood:** Low (bot restarts should be infrequent)
**Impact:** Low (minor UX annoyance, users can restart setup)

### Trade-off: Dual Whitelist Complexity

**Pro:** Better security, consistent access control
**Con:** More configuration to manage, potential for misconfiguration

**Decision:** Accept complexity for security benefit. Document well.

## Migration Plan

### Step 1: Deploy Code (No Config Changes)

1. Deploy refactored code to production
2. Existing deployments continue working (no `TELEGRAM_USER_IDS` set)
3. Private message setup flow starts working
4. No breaking changes yet

**Rollback:** Revert to previous version if issues detected

### Step 2: Test Private Message Flow (Optional)

1. Test GitHub setup via private messages
2. Verify whitelisted users can complete setup
3. Verify non-whitelisted users see error message

### Step 3: Enable User Whitelist (Optional)

1. Set `TELEGRAM_USER_IDS="123456,789012"` in environment
2. Restart bot
3. Verify group messages filtered by user whitelist
4. Monitor logs for filtered messages

**Rollback:** Remove `TELEGRAM_USER_IDS` environment variable and restart

### Monitoring

**Key metrics:**
- Messages filtered by user whitelist (log count)
- Private message interactions (success vs error responses)
- Setup session creation and completion rate
- Session cleanup frequency and count

**Alerts:**
- High rate of user whitelist filtering (possible misconfiguration)
- Private message errors spiking (authentication issues)
- Memory usage increase (session leak detection)

## Open Questions

1. **Should we persist sessions to MongoDB?**
   - Decision: No, keep in-memory for MVP. Revisit if session loss becomes a real problem.

2. **Should TELEGRAM_USER_IDS apply to both groups and private messages?**
   - Decision: Yes, consistent user whitelist across all message types simplifies security model.

3. **What happens if a user's GitHub PAT expires during setup?**
   - Decision: Out of scope for this change. PAT validation is handled by existing auth-setup.js code.

4. **Should we deprecate the unused whitelist.js module?**
   - Decision: Yes, remove it during cleanup phase (task 8.1) since it's not used anywhere.
