# Intent Classification - Spec Delta

## MODIFIED Requirements

### Requirement: Issue Number Pre-population

Intent classifier SHALL use referenced issue data when available before LLM extraction.

#### Scenario: Referenced issue available

**Given** workflow state contains `referencedIssue` with issue number
**And** intent type is `update_issue`
**When** classifying intent
**Then** `entities.issueNumber` is pre-populated from `referencedIssue.number`
**And** LLM does not need to extract issue number
**And** confidence in update intent is increased

#### Scenario: No referenced issue

**Given** `referencedIssue` is `null` in workflow state
**When** classifying intent
**Then** LLM attempts issue extraction from message text
**And** regex fallback is used if configured
**And** `entities.issueNumber` may be empty

#### Scenario: Referenced issue but different intent

**Given** workflow state contains `referencedIssue`
**But** LLM classifies intent as `create_bug` (not update)
**When** building entities
**Then** `entities.issueNumber` is NOT pre-populated
**And** referenced issue is ignored
**Because** user wants to create new issue, not update existing

### Requirement: Workflow State Integration

Workflow state schema SHALL include referenced issue metadata.

#### Scenario: Add referenced issue to state

**Given** AI processor receives enriched context from thread gatherer
**When** creating initial workflow state
**Then** `referencedIssue` field is added to state schema
**And** field is optional (nullable)
**And** structure matches:
```javascript
{
  number: string,
  url: string,
  operationId: string,
  sourceMessageId: number
} | null
```

#### Scenario: State without referenced issue

**Given** message is not a reply to bot feedback
**When** creating initial workflow state
**Then** `referencedIssue` field is `null`
**And** workflow proceeds normally

### Requirement: LLM Prompt Enhancement

Intent classification prompt SHALL instruct LLM about issue number extraction.

#### Scenario: Prompt includes extraction instructions

**Given** LLM prompt is constructed for classification
**When** message contains conversation context
**Then** prompt includes instructions to:
- Look for GitHub issue URLs in previous messages
- Extract issue numbers from #42 patterns
- Check for explicit issue references
- Prioritize update intent when issue is referenced

#### Scenario: Prompt with referenced issue hint

**Given** `referencedIssue` exists in state
**When** constructing LLM prompt
**Then** prompt includes hint about referenced issue
**And** suggests update intent if message seems related
**But** allows LLM to choose different intent if appropriate

### Requirement: Regex Extraction Integration

Intent classifier SHALL support regex-based issue extraction as fallback.

#### Scenario: Regex extraction in classifier

**Given** LLM returns empty `issueNumber`
**And** message text contains "#42"
**When** post-processing classifier output
**Then** regex extraction is attempted
**And** `entities.issueNumber` is populated with "42"
**And** extraction source is logged

#### Scenario: Regex patterns supported

**Given** regex extraction is configured
**When** extracting issue numbers
**Then** supports patterns:
- `#(\d+)` → matches "#42"
- `issue[s]?\s*#?(\d+)` → matches "issue 42", "issue #42", "issues 42"
- `github\.com/[^/]+/[^/]+/issues/(\d+)` → matches full URLs

#### Scenario: Regex extraction fails

**Given** message text has no recognizable patterns
**When** regex extraction is attempted
**Then** returns `null`
**And** classifier output remains unchanged

## ADDED Requirements

### Requirement: Extraction Source Logging

Issue number extraction source SHALL be logged for debugging and monitoring.

#### Scenario: Log database source

**Given** issue number extracted from database lookup
**When** logging classification result
**Then** includes `issueNumberSource: "database"`
**And** includes `referencedIssue.operationId`

#### Scenario: Log regex source

**Given** issue number extracted by regex
**When** logging classification result
**Then** includes `issueNumberSource: "regex"`
**And** includes matched pattern

#### Scenario: Log LLM source

**Given** issue number extracted by LLM
**When** logging classification result
**Then** includes `issueNumberSource: "llm"`
**And** includes LLM confidence score

#### Scenario: Log extraction failure

**Given** all extraction methods fail
**And** `entities.issueNumber` is empty
**When** logging classification result
**Then** includes `issueNumberSource: "none"`
**And** warns if intent is `update_issue`

## Cross-References

- Requires: `conversation-context` (referenced issue metadata)
- Requires: `reply-based-issue-extraction` (regex patterns)
