# Proposal: Fix Reply-to-Feedback Issue Number Extraction

## Summary

Enable users to update GitHub issues by replying to the bot's feedback messages. Currently, when a user replies to a feedback message with an update request, the bot fails to extract the issue number, causing the workflow to fail with a tool parsing error.

## Problem Statement

When a user replies to the bot's feedback message requesting to update an issue (e.g., "Update the issue to fix replies to all intents"), the bot encounters two critical bugs:

1. **Thread context caching fails** - The `gatherThreadContext()` function collects conversation context correctly but fails to cache it due to parameter mismatch with the repository method, resulting in the LLM receiving "No previous context available"

2. **No issue number extraction** - Even if context gathering worked, the bot has no mechanism to extract the issue number from:
   - The operations database (where issue numbers are stored after creation)
   - The feedback message itself (which often doesn't contain the issue URL)
   - Explicit issue references in the message text (#42, issue 42, etc.)

### Current Behavior

```
User: "Fix the login bug" → Bot creates issue #42
Bot: "👾 Issue created successfully!\n\n📎 https://github.com/user/repo/issues/42"
User: [replies to feedback] "Update the issue to add more context"
Bot: ❌ Error - Empty issueNumber field → Tool parsing exception
```

### Expected Behavior

```
User: "Fix the login bug" → Bot creates issue #42
Bot: "👾 Issue created successfully!\n\n📎 https://github.com/user/repo/issues/42"
User: [replies to feedback] "Update the issue to add more context"
Bot: ✅ Updates issue #42 successfully
```

## Proposed Solution

Implement deterministic issue number extraction through a two-phase approach:

### Phase 1: Fix Thread Context Caching

Fix parameter mismatch in `src/services/telegram/thread-context.js`:
- Correct calls to `cacheContext()` and `getContext()` to match repository method signatures
- Ensure conversation context is properly cached and retrieved

### Phase 2: Add Issue Number Extraction

Implement three-tier extraction strategy:

1. **Database lookup (primary)** - When user replies to bot's feedback message:
   - Detect bot messages in conversation thread
   - Query `feedback` table to find associated `operationId`
   - Retrieve full operation record to get `githubIssueNumber`

2. **Regex extraction (fallback)** - Parse explicit issue references:
   - `#42` patterns
   - `issue 42` or `issue #42` patterns
   - GitHub issue URLs

3. **LLM extraction (last resort)** - Let the LLM attempt extraction from context

## Capabilities Affected

This change introduces one new capability and modifies two existing ones:

1. **NEW: `reply-based-issue-extraction`** - Extract issue numbers from conversation context
2. **MODIFIED: `conversation-context`** - Fix caching and enrich with issue metadata
3. **MODIFIED: `intent-classification`** - Pre-populate issue numbers from context

## User Value

- **Faster workflow** - Users can update issues by replying to feedback messages without manually specifying issue numbers
- **Natural interaction** - Conversation-based updates feel more natural than remembering issue numbers
- **Error reduction** - Automatic extraction prevents "issue not found" errors
- **Better UX** - Aligns with chat-first philosophy

## Technical Scope

### Files Modified

- `src/services/telegram/thread-context.js` - Fix caching, add issue extraction
- `src/database/repositories/feedback.js` - Add `getFeedbackByMessageId()`
- `src/database/repositories/operations.js` - Add `getOperationById()`
- `src/ai/processor.js` - Handle enriched context format
- `src/ai/state-schema.js` - Add `referencedIssue` field
- `src/ai/intent-classifier.js` - Accept and use referenced issue data
- `prompts/intent-classification.txt` - Update instructions

### Testing Strategy

- Unit tests for context caching parameter marshalling
- Unit tests for database lookup methods
- Unit tests for regex extraction patterns
- Integration tests for full reply-to-feedback workflow
- Manual testing with various message formats

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking change to `gatherThreadContext()` return type | High | Return backward-compatible object that works as both array and object |
| Database lookup failures | Medium | Graceful fallback to regex and LLM extraction |
| Performance impact from database queries | Low | Cache feedback/operation lookups in memory |
| False positive issue extraction | Low | Prioritize database lookup over regex/LLM |

## Alternatives Considered

### Alternative 1: LLM-only extraction
**Rejected** - Unreliable, as demonstrated by current failures. The LLM cannot extract what isn't in the context.

### Alternative 2: Require explicit issue numbers
**Rejected** - Poor UX. Users would need to remember and specify issue numbers manually, defeating the purpose of conversation-based updates.

### Alternative 3: Include issue numbers in all feedback messages
**Rejected** - Would clutter feedback messages. Many feedback messages are for low-confidence or unknown intents where no issue was created.

## Dependencies

- None - This change is self-contained within the conversation context and intent classification systems

## Open Questions

None - Implementation approach is clear based on detailed code analysis.

## Approval Checklist

- [ ] Problem statement validated
- [ ] Solution approach agreed upon
- [ ] Spec deltas reviewed
- [ ] Tasks sequenced properly
- [ ] Tests planned
- [ ] Ready for implementation
