# Reply-Based Issue Extraction - Spec Delta

## ADDED Requirements

### Requirement: Feedback Lookup by Message ID

Feedback records SHALL be retrievable by Telegram message ID to link replies to operations.

#### Scenario: Query feedback by message ID

**Given** feedback message was posted with `feedbackMessageId` in chat
**When** `getFeedbackByMessageId(telegramChatId, messageId)` is called
**Then** feedback record is returned with fields:
- `operationId` (string) - linked operation ObjectId
- `feedbackMessageId` (number) - Telegram message ID
- `telegramChatId` (number) - chat ID
- `createdAt` (Date) - creation timestamp
- `dismissed` (boolean) - dismissal status

#### Scenario: Feedback message not found

**Given** message ID does not match any feedback record
**When** `getFeedbackByMessageId()` is called
**Then** returns `null`
**And** no error is thrown

#### Scenario: Multiple chats with same message ID

**Given** same message ID exists in different chats
**When** `getFeedbackByMessageId(chatId, messageId)` is called
**Then** returns feedback for the specific `chatId` match
**And** does not return feedback from other chats

### Requirement: Operation Lookup by ID

Operation records SHALL be retrievable by operation ID to access issue metadata.

#### Scenario: Query operation by ID

**Given** operation was created and stored with ObjectId
**When** `getOperationById(operationId)` is called
**Then** operation record is returned with fields:
- `githubIssueUrl` (string) - full GitHub issue URL
- `operationData.githubIssueNumber` (number) - issue number
- `operationType` (string) - type of operation
- `telegramGroupId` (number) - source group
- `createdAt` (Date) - creation timestamp

#### Scenario: Operation not found

**Given** operation ID does not exist in database
**When** `getOperationById()` is called
**Then** returns `null`
**And** no error is thrown

#### Scenario: Operation without issue data

**Given** operation exists but GitHub operation failed
**And** `githubIssueUrl` is null or undefined
**When** `getOperationById()` is called
**Then** returns operation record
**But** issue number extraction will yield `null`

### Requirement: Regex-Based Issue Extraction

Issue numbers SHALL be extractable from message text as fallback to database lookup.

#### Scenario: Extract from hashtag pattern

**Given** message text contains "#42"
**When** regex extraction is performed
**Then** issue number "42" is extracted
**And** returned as string

#### Scenario: Extract from issue reference

**Given** message text contains "issue 42" or "issue #42"
**When** regex extraction is performed
**Then** issue number "42" is extracted
**And** case-insensitive matching works

#### Scenario: Extract from GitHub URL

**Given** message text contains "github.com/owner/repo/issues/42"
**When** regex extraction is performed
**Then** issue number "42" is extracted
**And** protocol (https://) is optional

#### Scenario: Multiple issue numbers in text

**Given** message text contains "#42" and "#43"
**When** regex extraction is performed
**Then** first issue number is returned
**And** multiple matches are logged for debugging

#### Scenario: No issue number in text

**Given** message text has no recognizable issue patterns
**When** regex extraction is performed
**Then** returns `null`
**And** no error is thrown

### Requirement: Extraction Priority

Issue number extraction SHALL follow priority: database > regex > LLM.

#### Scenario: Database lookup succeeds

**Given** user replies to bot feedback message
**And** feedback → operation lookup succeeds
**When** extracting issue number
**Then** database value is used
**And** regex and LLM extraction are skipped

#### Scenario: Database lookup fails, regex succeeds

**Given** feedback message not found in database
**And** message text contains "#42"
**When** extracting issue number
**Then** regex extraction is used
**And** LLM extraction is skipped

#### Scenario: Database and regex fail, LLM fallback

**Given** feedback message not found
**And** no regex patterns match
**When** extracting issue number
**Then** LLM attempts extraction from context
**And** may return empty string if unsuccessful

### Requirement: Error Handling

Extraction failures SHALL be handled gracefully without crashing workflow.

#### Scenario: Database query error

**Given** database connection fails during feedback lookup
**When** `getFeedbackByMessageId()` is called
**Then** error is logged
**And** returns `null` instead of throwing
**And** workflow continues with fallback extraction

#### Scenario: Invalid operation ID

**Given** feedback record has malformed `operationId`
**When** `getOperationById()` is called
**Then** error is caught
**And** logged with feedback ID for debugging
**And** returns `null`

#### Scenario: Regex compilation error

**Given** regex pattern has syntax error
**When** regex extraction is attempted
**Then** error is caught and logged
**And** returns `null` gracefully

## Cross-References

- Used by: `conversation-context` (operation data retrieval)
- Used by: `intent-classification` (pre-populate entities)
