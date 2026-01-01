# Tasks: Fix Reply-to-Feedback Issue Number Extraction

## Phase 1: Fix Thread Context Caching (Critical Bug Fix)

### Task 1.1: Fix context caching parameter marshalling
**File:** `src/services/telegram/thread-context.js`

- Extract `rootMessageId` from `threadId` string (format: "chatId:rootMessageId")
- Convert `cacheTTL` from milliseconds to minutes
- Update `cacheContext()` call (line 124) to pass object parameter:
  ```javascript
  await contextRepo.cacheContext({
    telegramGroupId: chatId,
    threadRootMessageId: rootMessageId,
    messagesChain: messages,
    ttlMinutes: Math.floor(cacheTTL / 60000)
  });
  ```
- Update `getContext()` call (line 75) to pass separate parameters:
  ```javascript
  const cached = await contextRepo.getContext(chatId, rootMessageId);
  ```
- Fix return field access (line 82): use `cached.messagesChain` not `cached.messages`

**Validation:**
- Verify no caching errors in logs
- Verify LLM receives conversation context
- Unit test: context caching with correct parameters
- Unit test: context retrieval with correct parameters

**Dependencies:** None
**Parallel-safe:** Yes

---

### Task 1.2: Add unit tests for context caching fix
**File:** `test/unit/telegram/thread-context.test.js`

- Test context caching with object parameter
- Test threadId parsing to extract rootMessageId
- Test TTL conversion from milliseconds to minutes
- Test cached context retrieval
- Test cache miss handling

**Validation:**
- All tests pass
- Coverage >90% for caching logic

**Dependencies:** Task 1.1
**Parallel-safe:** No (depends on 1.1)

---

## Phase 2: Database Lookup Methods

### Task 2.1: Add getFeedbackByMessageId method
**File:** `src/database/repositories/feedback.js`

- Add `async getFeedbackByMessageId(telegramChatId, messageId)`
- Query `operation_feedback` collection
- Filter by `telegramChatId` AND `feedbackMessageId`
- Return feedback record with `operationId` or `null`
- Handle errors gracefully (log and return `null`)

**Validation:**
- Unit test: find existing feedback
- Unit test: return null when not found
- Unit test: filter by chat ID correctly
- Unit test: handle database errors

**Dependencies:** None
**Parallel-safe:** Yes (can run parallel with Task 2.2)

---

### Task 2.2: Add getOperationById method
**File:** `src/database/repositories/operations.js`

- Add `async getOperationById(operationId)`
- Convert string ID to ObjectId if needed
- Query `operations` collection by `_id`
- Return operation with `githubIssueUrl`, `operationData.githubIssueNumber`, etc.
- Return `null` if not found
- Handle errors gracefully (log and return `null`)

**Validation:**
- Unit test: find existing operation
- Unit test: return null when not found
- Unit test: handle ObjectId conversion
- Unit test: handle database errors

**Dependencies:** None
**Parallel-safe:** Yes (can run parallel with Task 2.1)

---

## Phase 3: Enrich Thread Context

### Task 3.1: Add bot message detection and operation lookup
**File:** `src/services/telegram/thread-context.js`

- After collecting messages (line 112), iterate through `messages` array
- Identify bot messages where `from.is_bot === true`
- For each bot message, call `getFeedbackByMessageId(chatId, messageId)`
- If feedback found, call `getOperationById(feedback.operationId)`
- If operation has issue data, build `referencedIssue` object
- Import `FeedbackRepository` and `OperationsRepository`

**Validation:**
- Unit test: detect bot messages in thread
- Unit test: skip user messages
- Unit test: successful feedback → operation lookup
- Unit test: handle missing feedback
- Unit test: handle missing operation

**Dependencies:** Task 2.1, Task 2.2
**Parallel-safe:** No (depends on database methods)

---

### Task 3.2: Change return type to enriched object
**File:** `src/services/telegram/thread-context.js`

- Modify return statements to return object:
  ```javascript
  return {
    messages: [...],
    referencedIssue: {...} || null
  };
  ```
- Update all return points (lines 56, 82, 131, 140)
- Ensure backward compatibility by returning plain `messages` array when no reply

**Validation:**
- Unit test: return enriched object with referenced issue
- Unit test: return enriched object without referenced issue
- Unit test: backward compatibility check
- Integration test: full reply-to-feedback flow

**Dependencies:** Task 3.1
**Parallel-safe:** No (depends on 3.1)

---

### Task 3.3: Update AI processor to handle new format
**File:** `src/ai/processor.js`

- Update line 54 to handle new return format:
  ```javascript
  const contextResult = await gatherThreadContext(mockCtx, options);
  conversationContext = Array.isArray(contextResult)
    ? contextResult
    : contextResult.messages || contextResult;
  const referencedIssue = contextResult.referencedIssue || null;
  ```
- Add `referencedIssue` to initial state (line 63):
  ```javascript
  initialState.referencedIssue = referencedIssue;
  ```
- Log when referenced issue is detected

**Validation:**
- Unit test: handle array return (backward compatibility)
- Unit test: handle object return with referencedIssue
- Unit test: handle object return without referencedIssue
- Integration test: referenced issue flows to intent classifier

**Dependencies:** Task 3.2
**Parallel-safe:** No (depends on 3.2)

---

## Phase 4: Intent Classification Integration

### Task 4.1: Add referencedIssue to workflow state schema
**File:** `src/ai/state-schema.js`

- Add optional `referencedIssue` field to `WorkflowState` schema:
  ```javascript
  referencedIssue: z.object({
    number: z.string(),
    url: z.string(),
    operationId: z.string(),
    sourceMessageId: z.number()
  }).nullable().optional()
  ```
- Update TypeScript definitions if present

**Validation:**
- Schema validation passes with referencedIssue
- Schema validation passes without referencedIssue
- Unit test: validate schema with all fields

**Dependencies:** None
**Parallel-safe:** Yes

---

### Task 4.2: Add regex extraction patterns
**File:** `src/ai/intent-classifier.js`

- Add regex patterns as constants:
  ```javascript
  const ISSUE_PATTERNS = [
    /#(\d+)/,
    /issue[s]?\s*#?(\d+)/i,
    /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/
  ];
  ```
- Add `extractIssueNumberFromText(text)` helper function
- Return first match or `null`
- Log matched pattern for debugging

**Validation:**
- Unit test: extract from "#42"
- Unit test: extract from "issue 42"
- Unit test: extract from GitHub URL
- Unit test: return null when no match
- Unit test: case insensitive matching

**Dependencies:** None
**Parallel-safe:** Yes

---

### Task 4.3: Pre-populate issue number from referenced issue
**File:** `src/ai/intent-classifier.js`

- Accept `state.referencedIssue` in classifier function
- After LLM classification, check if intent is `update_issue`
- If `referencedIssue` exists and intent is update:
  ```javascript
  if (intent === 'update_issue' && state.referencedIssue) {
    entities.issueNumber = state.referencedIssue.number;
    issueNumberSource = 'database';
  }
  ```
- Add fallback to regex extraction if database didn't work
- Add logging for extraction source

**Validation:**
- Unit test: pre-populate from database
- Unit test: skip pre-populate for non-update intents
- Unit test: fallback to regex
- Unit test: log extraction source

**Dependencies:** Task 4.1, Task 4.2
**Parallel-safe:** No (depends on schema and regex)

---

### Task 4.4: Update LLM prompt for issue extraction
**File:** `prompts/intent-classification.txt`

- Add section about issue number extraction:
  - Instruct to look for GitHub URLs in conversation history
  - Explain #42 pattern recognition
  - Emphasize checking previous messages for issue context
- Update `update_issue` intent examples
- Clarify that issue numbers should be strings

**Validation:**
- Manual review of prompt changes
- Promptfoo evaluation with new test cases:
  - Test: reply to feedback with update request
  - Test: explicit #42 reference
  - Test: GitHub URL in context

**Dependencies:** None
**Parallel-safe:** Yes

---

## Phase 5: Testing and Validation

### Task 5.1: Integration tests for full workflow
**File:** `test/integration/reply-to-feedback.test.js`

- Test complete flow: create issue → reply to feedback → update issue
- Test with different feedback message formats (with/without URL)
- Test database lookup success/failure paths
- Test regex extraction fallback
- Test error handling and graceful degradation

**Validation:**
- All integration tests pass
- Coverage >80% for new code paths

**Dependencies:** All previous tasks
**Parallel-safe:** No (depends on full implementation)

---

### Task 5.2: Manual testing and verification
**Prerequisites:** All tasks complete

- Start bot in test environment
- Create issue via bot: "Fix login bug #bug"
- Reply to feedback message: "Update the issue to add more context"
- Verify issue is updated successfully
- Test with various message formats
- Verify logs show correct extraction source
- Check Prometheus metrics for errors

**Validation:**
- Bot successfully extracts issue numbers from feedback replies
- No errors in logs
- Metrics show successful update operations

**Dependencies:** Task 5.1
**Parallel-safe:** No

---

## Summary

**Total Tasks:** 12
**Estimated Effort:** 2-3 days
**Parallelizable Work:** Tasks 2.1 + 2.2, Task 4.1 + 4.2 + 4.4
**Critical Path:** 1.1 → 1.2 → 2.1/2.2 → 3.1 → 3.2 → 3.3 → 4.3 → 5.1 → 5.2
