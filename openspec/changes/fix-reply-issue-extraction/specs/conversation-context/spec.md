# Conversation Context - Spec Delta

## MODIFIED Requirements

### Requirement: Thread Context Caching

Thread context SHALL be properly cached using the repository's expected parameter format.

#### Scenario: Cache context with correct parameters

**Given** conversation thread is gathered with 2+ messages
**When** `cacheContext()` is called
**Then** it receives an object parameter with `{ telegramGroupId, threadRootMessageId, messagesChain, ttlMinutes }`
**And** `threadRootMessageId` is extracted from `threadId` string format "chatId:rootMessageId"
**And** `cacheTTL` in milliseconds is converted to `ttlMinutes`
**And** context is successfully stored in database

#### Scenario: Retrieve cached context correctly

**Given** conversation context was previously cached
**When** `getContext()` is called
**Then** it receives `chatId` and `rootMessageId` as separate parameters (not `threadId` string)
**And** returns cached context with `messagesChain` field
**And** caller extracts `messagesChain` (not `messages`) from result

### Requirement: Enriched Context Return Format

Thread context gathering SHALL return both messages and referenced issue metadata.

#### Scenario: Return enriched context object

**Given** conversation thread is gathered
**When** `gatherThreadContext()` completes
**Then** it returns an object with structure:
```javascript
{
  messages: Array<Message>,
  referencedIssue: {
    number: string,
    url: string,
    operationId: string,
    sourceMessageId: number
  } | null
}
```

#### Scenario: Backward compatibility with array usage

**Given** existing code expects array return value
**When** result is used as array (via spread, map, etc.)
**Then** `messages` field is accessible
**Or** object can be checked with `Array.isArray()` and handled appropriately

#### Scenario: No referenced issue found

**Given** thread contains no bot feedback messages
**When** `gatherThreadContext()` completes
**Then** `referencedIssue` field is `null`
**And** `messages` contains collected thread messages

## ADDED Requirements

### Requirement: Feedback Message Detection

Bot messages in conversation threads SHALL be identified for operation lookup.

#### Scenario: Detect bot message in thread

**Given** conversation thread contains multiple messages
**When** iterating through collected messages
**Then** bot messages are identified by `from.is_bot === true`
**And** bot message IDs are extracted for database lookup

#### Scenario: No bot messages in thread

**Given** conversation thread contains only user messages
**When** searching for bot messages
**Then** no bot messages are found
**And** referenced issue extraction is skipped

### Requirement: Operation Data Retrieval

Operation data SHALL be retrieved from feedback messages to extract issue numbers.

#### Scenario: Retrieve operation from feedback message

**Given** bot message ID identified in thread
**When** `getFeedbackByMessageId(chatId, messageId)` is called
**Then** feedback record is returned with `operationId`
**When** `getOperationById(operationId)` is called
**Then** operation record is returned with `githubIssueNumber`, `githubIssueUrl`, and other metadata

#### Scenario: Feedback message not found

**Given** bot message in thread has no feedback record
**When** `getFeedbackByMessageId()` is called
**Then** returns `null`
**And** operation lookup is skipped gracefully

#### Scenario: Operation not found

**Given** feedback record exists but operation is missing
**When** `getOperationById()` is called
**Then** returns `null`
**And** referenced issue is not populated

### Requirement: Issue Metadata Extraction

Issue number and URL SHALL be extracted from operation data.

#### Scenario: Extract issue metadata from operation

**Given** operation record retrieved successfully
**And** operation has `githubIssueNumber` and `githubIssueUrl`
**When** building `referencedIssue` object
**Then** `number` is populated from `operationData.githubIssueNumber`
**And** `url` is populated from `githubIssueUrl`
**And** `operationId` is included
**And** `sourceMessageId` is set to bot message ID

#### Scenario: Operation without issue data

**Given** operation record exists but has no issue number
**When** attempting to extract issue metadata
**Then** `referencedIssue` remains `null`
**And** no error is thrown

## Cross-References

- Requires: `reply-based-issue-extraction` (database methods)
- Used by: `intent-classification` (enriched context consumption)
