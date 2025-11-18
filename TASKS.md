# TeleGit Development Tasks

This document provides a comprehensive breakdown of development tasks derived from PRD.md. Tasks are organized into logical phases with dependencies, complexity ratings, affected files, and testing requirements.

**Legend:**
- **Complexity**: Low (L) | Medium (M) | High (H)
- **Dependencies**: Tasks that must be completed first
- **Status**: ✓ Not Started | ⚠ In Progress | ✓ Complete

---

## Phase 1: Project Setup & Infrastructure

### 1.1 Project Scaffolding

#### Task 1.1.1: Initialize Project Structure
- **Description**: Create base directory structure for the application
- **Complexity**: Low
- **Dependencies**: None
- **Affected Components**:
  - `/src/` - Main source directory
  - `/src/services/` - Service layer
  - `/src/ai/` - AI processing
  - `/src/integrations/` - External integrations
  - `/src/database/` - Data persistence
  - `/src/queue/` - Rate limiting
  - `/src/utils/` - Utilities
  - `/src/monitoring/` - Observability
  - `/test/` - Test files
  - `/test/unit/` - Unit tests
  - `/test/integration/` - Integration tests
  - `/test/mocks/` - Mock data
  - `/test/helpers/` - Test helpers
  - `/config/` - Configuration files
  - `/k8s/` - Kubernetes manifests
- **Testing**: Verify directory structure exists
- **Status**: ✓

#### Task 1.1.2: Configure Package Dependencies
- **Description**: Set up package.json with all required dependencies
- **Complexity**: Medium
- **Dependencies**: Task 1.1.1
- **Affected Files**: `package.json`
- **Key Dependencies**:
  - Core: `telegraf`, `pg`, `bottleneck`
  - AI/LangChain: `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/mcp-adapters`
  - MCP SDK: `@modelcontextprotocol/sdk`
  - Testing: `vitest`, `@faker-js/faker`, `promptfoo`
  - Monitoring: `prom-client`, `pino`
  - Security: `crypto` (built-in)
- **Testing**: Run `npm install` successfully
- **Status**: ✓

#### Task 1.1.3: Configure TypeScript Definitions
- **Description**: Set up TypeScript type definitions (*.d.ts files only, no TS implementation)
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `src/types/telegram.d.ts`
  - `src/types/github.d.ts`
  - `src/types/workflow.d.ts`
  - `src/types/config.d.ts`
- **Testing**: No compilation errors when using types
- **Status**: ✓

#### Task 1.1.4: Environment Configuration Setup
- **Description**: Create environment variable templates and validation
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `.env.example`
  - `.env.test`
  - `config/env.js`
- **Environment Variables**:
  - `NODE_ENV`, `LOG_LEVEL`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`
  - `DATABASE_URL` (PostgreSQL connection string)
  - `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TEMPERATURE`
  - `GITHUB_MCP_SERVER_URL`
  - `ENCRYPTION_KEY` (64 hex chars for AES-256-GCM)
  - `RATE_LIMIT_MAX_CONCURRENT`, `RATE_LIMIT_MIN_TIME`
- **Testing**: Environment validation catches missing variables
- **Status**: ✓

#### Task 1.1.5: Configure Vitest
- **Description**: Set up Vitest testing framework with configuration
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `vitest.config.js`
  - `test/setup.js`
- **Testing**: Run `npm test` successfully (with placeholder test)
- **Status**: ✓

#### Task 1.1.6: Configure Promptfoo for LLM Testing
- **Description**: Set up Promptfoo for LLM evaluation and testing
- **Complexity**: Medium
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `promptfoo.config.yaml`
  - `test/prompts/classifier.txt`
- **Testing**: Run basic Promptfoo evaluation successfully
- **Status**: ✓

### 1.2 Test Infrastructure

#### Task 1.2.1: Create Mock Data Generators
- **Description**: Create faker-based mock data generators for testing
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `test/mocks/telegram.js`
  - `test/mocks/github.js`
  - `test/mocks/llm.js`
  - `test/mocks/database.js`
- **Factories**:
  - Mock Telegram messages
  - Mock Telegram users
  - Mock Telegram groups
  - Mock GitHub issues
  - Mock LLM responses
- **Testing**: Factories generate valid mock data
- **Status**: ✓

#### Task 1.2.2: Create Test Bot Helper
- **Description**: Create helper for test bot instances
- **Complexity**: Medium
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `test/helpers/bot.js`
  - `test/helpers/database.js`
- **Features**:
  - Create isolated test bot
  - Mock Telegram API
  - Mock database
  - Mock LLM
- **Testing**: Test helper creates functional mock bot
- **Status**: ✓

---

## Phase 2: Database & Data Layer

### 2.1 Database Schema

#### Task 2.1.1: Create PostgreSQL Database Schema
- **Description**: Define and create database tables for group configs, operations, feedback, and context
- **Complexity**: Medium
- **Dependencies**: None
- **Affected Files**: `db/schema.sql`
- **Tables**:
  - `group_configs` - Telegram group configuration and GitHub credentials
  - `operations` - Operation history and tracking
  - `operation_feedback` - Feedback message tracking for auto-deletion
  - `conversation_context` - Cached conversation threads
- **Testing**: Schema applies without errors, constraints work
- **Status**: ✓

#### Task 2.1.2: Set Up Database Migrations
- **Description**: Create migration system for database schema versioning
- **Complexity**: Low
- **Dependencies**: Task 2.1.1
- **Affected Files**:
  - `db/migrations/001_initial_schema.sql`
  - `db/migrate.js`
- **Testing**: Migrations run successfully, rollback works
- **Status**: ✓

### 2.2 Data Access Layer

#### Task 2.2.1: Implement PostgreSQL Client Setup
- **Description**: Create PostgreSQL client initialization and connection management using `pg` library
- **Complexity**: Low
- **Dependencies**: Task 1.1.4, Task 2.1.1
- **Affected Files**: `src/database/db.js`
- **Testing**: Connection establishes successfully, environment variables loaded, connection pooling configured
- **Status**: ✓

#### Task 2.2.2: Implement ConfigRepository
- **Description**: Create repository for group configuration CRUD operations
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1
- **Affected Files**: `src/database/repositories/config.js`
- **Methods**:
  - `getGroupConfig(groupId)` - Retrieve config for a Telegram group
  - `setGroupConfig(groupId, config)` - Create/update group config
  - `deleteGroupConfig(groupId)` - Remove group config
  - `encrypt(token)` - Encrypt GitHub PAT (AES-256-GCM)
  - `decrypt(encryptedToken)` - Decrypt GitHub PAT
- **Testing**: CRUD operations work, encryption/decryption functional
- **Status**: ✓

#### Task 2.2.3: Implement OperationsRepository
- **Description**: Create repository for operation tracking and history
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1
- **Affected Files**: `src/database/repositories/operations.js`
- **Methods**:
  - `createOperation(data)` - Record new operation
  - `updateOperationStatus(id, status)` - Update operation status
  - `getOperationByMessageId(messageId)` - Retrieve operation by Telegram message
  - `getGroupOperationHistory(groupId, limit)` - Get recent operations for group
- **Testing**: Operations stored and retrieved correctly
- **Status**: ✓

#### Task 2.2.4: Implement FeedbackRepository
- **Description**: Create repository for managing feedback messages and auto-deletion
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1
- **Affected Files**: `src/database/repositories/feedback.js`
- **Methods**:
  - `createFeedback(operationId, messageId, scheduledDeletion)` - Record feedback message
  - `getFeedbackByMessageId(messageId)` - Retrieve feedback record
  - `markDismissed(messageId)` - Mark feedback as dismissed
  - `getScheduledDeletions()` - Get all messages scheduled for deletion
  - `deleteFeedback(messageId)` - Remove feedback record
- **Testing**: Feedback tracking and scheduled deletion queries work
- **Status**: ✓

#### Task 2.2.5: Implement ConversationContextRepository
- **Description**: Create repository for caching conversation context
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1
- **Affected Files**: `src/database/repositories/context.js`
- **Methods**:
  - `cacheContext(groupId, threadId, messages, ttl)` - Store conversation thread
  - `getContext(groupId, threadId)` - Retrieve cached thread
  - `invalidateExpiredContexts()` - Clean up expired cache entries
- **Testing**: Context caching and retrieval work, TTL expiration functional
- **Status**: ✓

#### Task 2.2.6: Unit Tests - Database Repositories
- **Description**: Test all database repositories
- **Complexity**: Medium
- **Dependencies**: Task 2.2.2, Task 2.2.3, Task 2.2.4, Task 2.2.5
- **Affected Files**: `test/unit/database/repositories.test.js`
- **Test Cases**:
  - ConfigRepository CRUD operations
  - ConfigRepository encryption/decryption
  - OperationsRepository CRUD operations
  - FeedbackRepository CRUD operations
  - FeedbackRepository scheduled deletion queries
  - ConversationContextRepository caching
  - ConversationContextRepository TTL expiration
- **Testing**: All repository tests pass
- **Status**: ✓

---

## Phase 3: Telegram Bot Service

### 3.1 Bot Core

#### Task 3.1.1: Initialize Telegraf Bot
- **Description**: Set up Telegraf bot instance with webhook/polling configuration
- **Complexity**: Medium
- **Dependencies**: Task 1.1.4, Task 2.2.1
- **Affected Files**: `src/services/telegram/bot.js`
- **Features**:
  - Bot initialization with token
  - Webhook setup (production) / Polling (development)
  - Graceful shutdown handling
  - Error handling and reconnection
- **Testing**: Bot starts successfully, responds to basic commands
- **Status**: ✓

#### Task 3.1.2: Implement Message Filtering
- **Description**: Create message filter to detect triggers (@mention, #hashtag)
- **Complexity**: Low
- **Dependencies**: Task 3.1.1
- **Affected Files**: `src/services/telegram/filters.js`
- **Logic**:
  - Check for bot @mention in message
  - Check for #hashtag in message text
  - Validate message is from allowed group (whitelist)
  - Validate message is from allowed user (whitelist)
- **Testing**: Correctly identifies triggered vs non-triggered messages
- **Status**: ✓

#### Task 3.1.2a: Unit Tests - Message Filtering
- **Description**: Test message trigger detection
- **Complexity**: Low
- **Dependencies**: Task 3.1.2
- **Affected Files**: `test/unit/telegram/filters.test.js`
- **Test Cases**:
  - @mention detected correctly
  - #hashtag detected correctly
  - Non-triggered messages ignored
  - Group whitelisting enforced
  - User whitelisting enforced
  - Combined triggers work
- **Testing**: All filter tests pass
- **Status**: ✓

#### Task 3.1.3: Implement Message Handler
- **Description**: Create main message processing handler with queueing
- **Complexity**: Medium
- **Dependencies**: Task 3.1.2, Task 3.2.1
- **Affected Files**: `src/services/telegram/handlers.js`
- **Logic**:
  1. Filter message with trigger detection
  2. Check GitHub authentication for group
  3. Add "👀" reaction (analyzing)
  4. Queue message for AI processing
  5. Handle processing errors
- **Testing**: Messages queued correctly, reactions applied
- **Status**: ✓

#### Task 3.1.4: Implement Reaction Management
- **Description**: Create reaction handling for status updates and controls
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1
- **Affected Files**: `src/services/telegram/reactions.js`
- **Features**:
  - `setReaction(messageId, emoji)` - Add/update reaction
  - Status reactions: 👀 (analyzing), 🤔 (processing), 👾/🫡/🦄 (success variants), 😵‍💫 (error)
  - User control reactions: 👎 (undo), 👍 (dismiss feedback)
- **Testing**: Reactions update correctly, control reactions trigger actions
- **Status**: ✓

#### Task 3.1.5: Implement User Reaction Handler
- **Description**: Handle user reactions for undo and dismiss actions
- **Complexity**: High
- **Dependencies**: Task 3.1.4, Task 2.2.3, Task 2.2.4
- **Affected Files**: `src/services/telegram/reaction-handler.js`
- **Logic**:
  - Detect 👎 reaction on feedback message → undo associated operation
  - Detect 👍 reaction on feedback message → dismiss (delete) feedback immediately
  - Look up operation by feedback message ID
  - Trigger undo logic for GitHub operations
- **Testing**: Undo reverts GitHub actions, dismiss deletes feedback
- **Status**: ✓

#### Task 3.1.5a: Integration Tests - Reaction Controls
- **Description**: Test user reaction-based controls
- **Complexity**: Medium
- **Dependencies**: Task 3.1.5
- **Affected Files**: `test/integration/reaction-controls.test.js`
- **Test Cases**:
  - 👎 reaction triggers undo
  - 👍 reaction dismisses feedback
  - Undo reverts GitHub operation
  - Dismiss deletes feedback message immediately
  - Invalid reactions ignored
- **Testing**: All reaction control tests pass
- **Status**: ✓

#### Task 3.1.6: Implement Feedback Message Lifecycle
- **Description**: Create system for posting and auto-deleting feedback messages
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1, Task 2.2.4
- **Affected Files**: `src/services/telegram/feedback.js`
- **Features**:
  - `postFeedback(chatId, replyToId, message)` - Post feedback as reply
  - `scheduleDeletion(messageId, delay)` - Schedule message for deletion (10 min default)
  - `deleteMessage(chatId, messageId)` - Delete message
  - Background job to process scheduled deletions
- **Testing**: Feedback posts correctly, auto-deletes after timeout
- **Status**: ✓

### 3.2 Authentication Flow

#### Task 3.2.1: Implement GitHub Authentication Check
- **Description**: Check if group has GitHub authentication configured
- **Complexity**: Low
- **Dependencies**: Task 2.2.2
- **Affected Files**: `src/services/telegram/auth-check.js`
- **Logic**:
  - Query `group_configs` for group
  - Return true if valid config exists
  - Return false otherwise
- **Testing**: Correctly identifies authenticated vs unauthenticated groups
- **Status**: ✓

#### Task 3.2.2: Implement PAT Setup Workflow
- **Description**: Create DM-based workflow for GitHub PAT configuration
- **Complexity**: High
- **Dependencies**: Task 3.1.1, Task 2.2.2
- **Affected Files**: `src/services/telegram/auth-setup.js`
- **Flow**:
  1. Detect unauthenticated group trigger
  2. Post auth required message in group
  3. Send DM to user with instructions
  4. Request GitHub repository URL
  5. Request GitHub PAT
  6. Validate PAT format
  7. Test PAT with GitHub API
  8. Encrypt and store PAT on success
  9. Post success message in group
  10. Handle errors and retry
- **Testing**: Complete auth flow works, PAT validated and stored
- **Status**: ✓

#### Task 3.2.3: Implement PAT Validation
- **Description**: Validate GitHub PAT format and permissions
- **Complexity**: Medium
- **Dependencies**: Task 3.2.2, Task 4.1.1
- **Affected Files**: `src/services/telegram/pat-validator.js`
- **Validation**:
  - Check PAT format (ghp_*)
  - Test authentication with GitHub API
  - Verify repository access permissions
  - Verify required scopes (repo, issues)
- **Testing**: Valid PATs pass, invalid PATs rejected with helpful errors
- **Status**: ✓

#### Task 3.2.3a: Integration Tests - Auth Flow
- **Description**: Test GitHub authentication setup flow
- **Complexity**: High
- **Dependencies**: Task 3.2.3
- **Affected Files**: `test/integration/auth-flow.test.js`
- **Test Cases**:
  - Complete PAT setup flow
  - PAT format validation
  - PAT authentication validation
  - Invalid PAT handling with helpful errors
  - Retry logic for failures
  - Encrypted PAT storage
- **Testing**: All auth flow tests pass
- **Status**: ✓

### 3.3 Conversation Threading

#### Task 3.3.1: Implement Thread Context Gathering
- **Description**: Gather conversation context from message threads
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1, Task 2.2.5
- **Affected Files**: `src/services/telegram/thread-context.js`
- **Logic**:
  - Detect if message is a reply
  - Walk up reply chain to thread root
  - Collect all messages in thread
  - Cache thread context for performance
  - Handle cache expiration
- **Testing**: Thread context correctly assembled, caching works
- **Status**: ✓

---

## Phase 4: AI Processing Engine

### 4.1 LangChain Setup

#### Task 4.1.1: Initialize LLM Clients
- **Description**: Set up LLM client(s) for OpenAI/Anthropic
- **Complexity**: Low
- **Dependencies**: Task 1.1.4
- **Affected Files**: `src/ai/llm-client.js`
- **Features**:
  - Support for multiple providers (OpenAI, Anthropic)
  - Provider selection via environment variable
  - Model configuration
  - Error handling and retries
- **Testing**: LLM client initializes, makes successful API calls
- **Status**: ✓

#### Task 4.1.2: Define LangGraph State Schema
- **Description**: Create state schema for LangGraph workflow
- **Complexity**: Low
- **Dependencies**: Task 4.1.1
- **Affected Files**: `src/ai/state-schema.js`
- **State Channels**:
  - `telegramMessage` - Input message object
  - `intent` - Classified intent and entities
  - `conversationContext` - Thread messages
  - `githubOperation` - Operation to execute
  - `result` - Operation result
  - `timestamps` - Processing timestamps
- **Testing**: State schema validates correctly
- **Status**: ✓

### 4.2 Intent Classification

#### Task 4.2.1: Implement Intent Classifier
- **Description**: Create LLM-based intent classification system
- **Complexity**: High
- **Dependencies**: Task 4.1.1, Task 4.1.2
- **Affected Files**: `src/ai/intent-classifier.js`
- **Intent Types**:
  - `create_bug` - Bug report
  - `create_task` - Task/todo
  - `create_idea` - Feature idea
  - `update_issue` - Update existing issue
  - `search_issues` - Search for issues
  - `unknown` - Cannot classify
- **Output Schema**:
  - `intent` - Intent type
  - `confidence` - Confidence score (0-1)
  - `entities` - Extracted entities (title, description, labels, assignees)
- **Testing**: Correctly classifies various message types with Promptfoo
- **Status**: ✓

#### Task 4.2.1a: Unit Tests - Intent Classifier
- **Description**: Test intent classification with various message types
- **Complexity**: Medium
- **Dependencies**: Task 4.2.1
- **Affected Files**: `test/unit/ai/intent-classifier.test.js`
- **Test Cases**:
  - Bug reports identified correctly
  - Tasks identified correctly
  - Ideas identified correctly
  - Updates identified correctly
  - Unknown messages handled gracefully
  - Confidence scores appropriate
  - Entities extracted correctly
  - Edge cases (empty, very long, special characters)
- **Testing**: All intent classifier unit tests pass
- **Status**: ✓

#### Task 4.2.2: Create Intent Classification Prompts
- **Description**: Write and optimize prompts for intent classification
- **Complexity**: Medium
- **Dependencies**: Task 4.2.1
- **Affected Files**: `prompts/intent-classification.txt`
- **Prompt Requirements**:
  - Clear intent type definitions
  - Few-shot examples for each intent
  - Entity extraction instructions
  - Confidence scoring guidance
- **Testing**: Promptfoo evaluations show >80% accuracy
- **Status**: ✓

#### Task 4.2.2a: Promptfoo Evaluation - Intent Classification
- **Description**: Evaluate intent classification accuracy with Promptfoo
- **Complexity**: Medium
- **Dependencies**: Task 4.2.2
- **Affected Files**: `test/promptfoo/intent-classification.yaml`
- **Test Cases**:
  - Bug detection accuracy (target >80%)
  - Task detection accuracy (target >80%)
  - Idea detection accuracy (target >80%)
  - Update detection accuracy (target >80%)
  - Entity extraction accuracy
  - Confidence calibration
  - Edge cases and ambiguous messages
- **Testing**: Promptfoo evaluation shows >80% overall accuracy
- **Status**: ✓

### 4.3 LangGraph Workflow

#### Task 4.3.1: Implement LangGraph Workflow Graph
- **Description**: Create LangGraph workflow with nodes and edges
- **Complexity**: High
- **Dependencies**: Task 4.1.2, Task 4.2.1
- **Affected Files**: `src/ai/workflow.js`
- **Nodes**:
  - `analyze` - Intent classification
  - `search` - Search for issues
  - `create` - Create new issue
  - `update` - Update existing issue
  - `format` - Format issue data
  - `execute` - Execute GitHub operation
  - `store` - Store operation result
  - `notify` - Send feedback
  - `error` - Error handling
- **Edges**:
  - Conditional routing based on intent type
  - Error handling paths
- **Testing**: Workflow executes correctly for each intent type
- **Status**: ✓

#### Task 4.3.2: Implement Analyze Node
- **Description**: Create analyze node for intent classification
- **Complexity**: Medium
- **Dependencies**: Task 4.2.1, Task 4.3.1
- **Affected Files**: `src/ai/nodes/analyze.js`
- **Logic**:
  - Receive message and context
  - Call intent classifier
  - Update state with intent and entities
  - Route to next node based on intent
- **Testing**: Correctly classifies and routes messages
- **Status**: ✓

#### Task 4.3.3: Implement Search Node
- **Description**: Create search node for finding issues
- **Complexity**: Medium
- **Dependencies**: Task 4.3.1, Task 5.2.1
- **Affected Files**: `src/ai/nodes/search.js`
- **Logic**:
  - Build search query from intent entities
  - Call GitHub search tool
  - Parse and rank results
  - Select best match or create new
- **Testing**: Finds relevant issues accurately
- **Status**: ✓

#### Task 4.3.4: Implement Create Node
- **Description**: Create node for issue creation operations
- **Complexity**: Medium
- **Dependencies**: Task 4.3.1, Task 5.2.1
- **Affected Files**: `src/ai/nodes/create.js`
- **Logic**:
  - Extract issue details from intent entities
  - Format title, body, labels, assignees
  - Validate required fields
  - Prepare GitHub create operation
- **Testing**: Correctly formats issue creation data
- **Status**: ✓

#### Task 4.3.5: Implement Update Node
- **Description**: Create node for issue update operations
- **Complexity**: Medium
- **Dependencies**: Task 4.3.1, Task 4.3.3, Task 5.2.1
- **Affected Files**: `src/ai/nodes/update.js`
- **Logic**:
  - Identify issue to update (from search results)
  - Extract update fields from intent
  - Merge with existing issue data
  - Prepare GitHub update operation
- **Testing**: Correctly updates existing issues
- **Status**: ✓

#### Task 4.3.6: Implement Format Node
- **Description**: Create node for formatting issue data
- **Complexity**: Low
- **Dependencies**: Task 4.3.4, Task 4.3.5
- **Affected Files**: `src/ai/nodes/format.js`
- **Logic**:
  - Format markdown body
  - Add metadata footer (created by TeleGit)
  - Process image attachments
  - Sanitize user input
- **Testing**: Issue data formatted correctly, XSS-safe
- **Status**: ✓

#### Task 4.3.6a: Promptfoo Evaluation - Issue Formatting
- **Description**: Evaluate issue formatting quality with Promptfoo
- **Complexity**: Medium
- **Dependencies**: Task 4.3.6
- **Affected Files**: `test/promptfoo/issue-formatting.yaml`
- **Test Cases**:
  - Title quality and clarity
  - Body structure and clarity
  - Label appropriateness
  - Markdown formatting correctness
  - Metadata inclusion
  - Image reference handling
- **Testing**: Promptfoo evaluation shows high quality formatting
- **Status**: ✓

#### Task 4.3.7: Implement Execute Node
- **Description**: Create node for executing GitHub operations via MCP
- **Complexity**: Medium
- **Dependencies**: Task 4.3.6, Task 5.2.1
- **Affected Files**: `src/ai/nodes/execute.js`
- **Logic**:
  - Invoke appropriate GitHub MCP tool
  - Handle tool errors
  - Extract result data (issue URL, number)
  - Update state with result
- **Testing**: Successfully executes GitHub operations
- **Status**: ✓

#### Task 4.3.8: Implement Store Node
- **Description**: Create node for storing operation records
- **Complexity**: Low
- **Dependencies**: Task 4.3.7, Task 2.2.3
- **Affected Files**: `src/ai/nodes/store.js`
- **Logic**:
  - Create operation record in database
  - Store operation type, GitHub URL, status
  - Link to Telegram message ID
- **Testing**: Operation records stored correctly
- **Status**: ✓

#### Task 4.3.9: Implement Notify Node
- **Description**: Create node for sending Telegram feedback
- **Complexity**: Medium
- **Dependencies**: Task 4.3.8, Task 3.1.6
- **Affected Files**: `src/ai/nodes/notify.js`
- **Logic**:
  - Update message reaction to success emoji (👾/🫡/🦄)
  - Generate feedback message with GitHub link
  - Post feedback as reply
  - Schedule feedback deletion
  - Create feedback record in database
- **Testing**: Feedback posted correctly, scheduled for deletion
- **Status**: ✓

#### Task 4.3.10: Implement Error Handler Node
- **Description**: Create node for error handling
- **Complexity**: Medium
- **Dependencies**: Task 4.3.1
- **Affected Files**: `src/ai/nodes/error.js`
- **Logic**:
  - Update reaction to error emoji (😵‍💫)
  - Generate user-friendly error message
  - Log detailed error for debugging
  - Post error feedback
  - Schedule error message deletion
- **Testing**: Errors handled gracefully, user gets helpful feedback
- **Status**: ✓

### 4.4 Main AI Processor

#### Task 4.4.1: Implement Message Processor
- **Description**: Create main entry point for AI message processing
- **Complexity**: High
- **Dependencies**: Task 4.3.1, Task 3.3.1
- **Affected Files**: `src/ai/processor.js`
- **Logic**:
  - Receive Telegram message from queue
  - Gather conversation context if reply
  - Get group GitHub configuration
  - Initialize GitHub MCP tools with PAT
  - Initialize and run LangGraph workflow
  - Handle workflow errors
  - Return result
- **Testing**: End-to-end message processing works
- **Status**: ✓

#### Task 4.4.1a: Integration Tests - Telegram to GitHub Flow
- **Description**: Test end-to-end message processing flow
- **Complexity**: High
- **Dependencies**: Task 4.4.1
- **Affected Files**: `test/integration/telegram-github-flow.test.js`
- **Test Cases**:
  - Bug report creates GitHub issue correctly
  - Task creates GitHub issue correctly
  - Feature idea creates GitHub issue correctly
  - Update finds and updates existing issue
  - Reactions update correctly through workflow
  - Feedback posted and scheduled for deletion
  - Thread context properly gathered and used
  - Error handling and recovery
- **Testing**: All end-to-end integration tests pass
- **Status**: ✓

---

## Phase 5: GitHub MCP Integration

### 5.1 MCP Client Setup

#### Task 5.1.1: Implement MCP Client Initialization
- **Description**: Set up Model Context Protocol client with SSE transport
- **Complexity**: Medium
- **Dependencies**: Task 1.1.4
- **Affected Files**: `src/integrations/github/mcp-client.js`
- **Features**:
  - SSE transport configuration
  - MCP client initialization
  - Connection management
  - Error handling and reconnection
- **Testing**: MCP client connects to server successfully
- **Status**: ✓

#### Task 5.1.2: Implement MCP-to-LangChain Tool Adapter
- **Description**: Wrap GitHub MCP server as LangChain tools using official adapter
- **Complexity**: Medium
- **Dependencies**: Task 5.1.1
- **Affected Files**: `src/integrations/github/mcp-adapter.js`
- **Features**:
  - Use `wrapMCPServer` from `@langchain/mcp-adapters`
  - Configure GitHub PAT authentication
  - Filter specific tools (create_issue, update_issue, search_issues)
  - Tool invocation and response handling
- **Testing**: MCP tools usable as LangChain tools
- **Status**: ✓

### 5.2 GitHub Operations

#### Task 5.2.1: Implement GitHub Tool Functions
- **Description**: Create wrapper functions for GitHub MCP tools
- **Complexity**: Low
- **Dependencies**: Task 5.1.2
- **Affected Files**: `src/integrations/github/tools.js`
- **Functions**:
  - `createIssue(repository, title, body, labels, assignees)`
  - `updateIssue(repository, issueNumber, data)`
  - `searchIssues(repository, query, options)`
- **Testing**: Each tool function works correctly
- **Status**: ✓

#### Task 5.2.2: Implement Image Processing
- **Description**: Process Telegram images for GitHub issue attachments
- **Complexity**: High
- **Dependencies**: Task 5.2.1, Task 5.2.3
- **Affected Files**: `src/integrations/github/image-processor.js`
- **Logic**:
  - Detect image attachments in Telegram message
  - Get file path from Telegram API
  - Use proxy endpoint to fetch image (keep token secure)
  - Upload to GitHub or use proxy URL
  - Replace Telegram URLs in issue body with proxy URLs
- **Testing**: Images attached to issues correctly
- **Status**: ✓

#### Task 5.2.3: Implement Telegram Asset Proxy
- **Description**: Create proxy endpoint for Telegram assets to hide bot token
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1
- **Affected Files**: `src/api/telegram-asset-proxy.js`
- **Logic**:
  - Accept file path as parameter
  - Construct full Telegram URL with bot token (server-side)
  - Fetch asset from Telegram
  - Stream response to client
  - Add caching headers
- **Testing**: Assets proxied correctly, token not exposed
- **Status**: ✓

#### Task 5.2.4: Implement Undo Operation Logic
- **Description**: Create logic to revert GitHub operations
- **Complexity**: High
- **Dependencies**: Task 5.2.1, Task 2.2.3
- **Affected Files**: `src/integrations/github/undo.js`
- **Undo Actions**:
  - Create → Close issue with "Undone by TeleGit" comment
  - Update → Revert to previous state (requires storing old state)
  - Cannot undo search operations
- **Testing**: Undo correctly reverts operations
- **Status**: ✓

---

## Phase 6: Rate Limiting & Queue Management

### 6.1 Rate Limiters

#### Task 6.1.1: Implement Telegram Rate Limiter
- **Description**: Configure Bottleneck for Telegram API rate limits
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `src/queue/telegram-limiter.js`
- **Configuration**:
  - Max concurrent: 1
  - Min time: 34ms (~30 msgs/sec)
  - Reservoir: 30 requests
  - Refresh: 30 requests/second
- **Testing**: Rate limits enforced, no 429 errors from Telegram
- **Status**: ✓

#### Task 6.1.2: Implement GitHub Rate Limiter
- **Description**: Configure Bottleneck for GitHub API rate limits
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `src/queue/github-limiter.js`
- **Configuration**:
  - Max concurrent: 2
  - Min time: 720ms (~83 requests/min)
  - Reservoir: 100 requests
  - Refresh: 83 requests/minute
- **Testing**: Rate limits enforced, stays within GitHub limits
- **Status**: ✓

#### Task 6.1.3: Implement LLM Rate Limiter
- **Description**: Configure Bottleneck for LLM API rate limits
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `src/queue/llm-limiter.js`
- **Configuration**:
  - Max concurrent: 3
  - Min time: 200ms
  - Reservoir: 50 requests
  - Refresh: 50 requests/minute (adjust per provider)
- **Testing**: Rate limits enforced, no rate limit errors from LLM API
- **Status**: ✓

### 6.2 Message Queue

#### Task 6.2.1: Implement Message Processing Queue
- **Description**: Create queue for message processing with priority
- **Complexity**: Medium
- **Dependencies**: Task 6.1.1, Task 6.1.2, Task 6.1.3
- **Affected Files**: `src/queue/message-queue.js`
- **Features**:
  - Priority queue (urgent messages first)
  - Retry logic with exponential backoff
  - Error handling
  - Queue metrics (size, processing time)
- **Testing**: Messages processed in order, retries work
- **Status**: ✓

#### Task 6.2.2: Implement Scheduled Deletion Queue
- **Description**: Create background job for scheduled feedback deletion
- **Complexity**: Medium
- **Dependencies**: Task 2.2.4, Task 3.1.6
- **Affected Files**: `src/queue/deletion-queue.js`
- **Features**:
  - Poll for scheduled deletions (every minute)
  - Delete messages that reached timeout
  - Update database records
  - Handle deletion errors (message already deleted)
- **Testing**: Feedback messages auto-delete after timeout
- **Status**: ✓

---

## Phase 7: Security & Access Control

### 7.1 Encryption

#### Task 7.1.1: Implement Token Encryption
- **Description**: Create AES-256-GCM encryption for GitHub PATs
- **Complexity**: Medium
- **Dependencies**: Task 1.1.4
- **Affected Files**: `src/utils/encryption.js`
- **Functions**:
  - `encrypt(plaintext)` - Encrypt with AES-256-GCM
  - `decrypt(ciphertext)` - Decrypt ciphertext
  - Use `ENCRYPTION_KEY` from environment (32 bytes)
  - Generate random IV for each encryption
- **Testing**: Encryption/decryption roundtrip works, tamper detection works
- **Status**: ✓

#### Task 7.1.1a: Unit Tests - Encryption
- **Description**: Test token encryption/decryption
- **Complexity**: Low
- **Dependencies**: Task 7.1.1
- **Affected Files**: `test/unit/utils/encryption.test.js`
- **Test Cases**:
  - Encryption/decryption roundtrip successful
  - Tamper detection works
  - Different IVs for same plaintext
  - Invalid ciphertext rejected
  - Missing encryption key handling
- **Testing**: All encryption tests pass
- **Status**: ✓

### 7.2 Access Control

#### Task 7.2.1: Implement Group Whitelist
- **Description**: Create whitelist for allowed Telegram groups
- **Complexity**: Low
- **Dependencies**: Task 1.1.4
- **Affected Files**: `src/services/telegram/whitelist.js`
- **Logic**:
  - Parse `ALLOWED_GROUPS` environment variable
  - Check if group ID is in whitelist
  - Reject messages from non-whitelisted groups
- **Testing**: Only whitelisted groups can use bot
- **Status**: ✓

#### Task 7.2.2: Implement User Whitelist
- **Description**: Create whitelist for allowed Telegram users
- **Complexity**: Low
- **Dependencies**: Task 1.1.4
- **Affected Files**: `src/services/telegram/whitelist.js`
- **Logic**:
  - Parse `ALLOWED_USERS` environment variable
  - Check if user ID is in whitelist
  - Reject messages from non-whitelisted users
- **Testing**: Only whitelisted users can trigger bot
- **Status**: ✓

### 7.3 Input Validation

#### Task 7.3.1: Implement Input Sanitization
- **Description**: Sanitize all Telegram input to prevent injection attacks
- **Complexity**: Medium
- **Dependencies**: None
- **Affected Files**: `src/utils/sanitize.js`
- **Sanitization**:
  - Remove/escape potentially dangerous characters
  - Validate message length limits
  - Sanitize markdown for GitHub
  - Prevent XSS in issue bodies
- **Testing**: Malicious input sanitized, normal input preserved
- **Status**: ✓

#### Task 7.3.1a: Unit Tests - Sanitization
- **Description**: Test input sanitization
- **Complexity**: Low
- **Dependencies**: Task 7.3.1
- **Affected Files**: `test/unit/utils/sanitize.test.js`
- **Test Cases**:
  - XSS attempts blocked
  - SQL injection attempts blocked
  - Script tags removed/escaped
  - Normal input preserved
  - Markdown formatted correctly
  - Length limits enforced
  - Unicode handling
- **Testing**: All sanitization tests pass
- **Status**: ✓

#### Task 7.3.2: Implement Schema Validation
- **Description**: Validate LLM outputs against defined schemas
- **Complexity**: Low
- **Dependencies**: Task 4.2.1
- **Affected Files**: `src/utils/schema-validator.js`
- **Validation**:
  - Intent schema validation
  - Entity extraction validation
  - Type checking
  - Required field validation
- **Testing**: Invalid LLM outputs rejected
- **Status**: ✓

### 7.4 Webhook Security

#### Task 7.4.1: Implement Webhook Signature Verification
- **Description**: Verify Telegram webhook signatures
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1
- **Affected Files**: `src/services/telegram/webhook-verify.js`
- **Logic**:
  - Verify webhook secret from environment
  - Validate signature header
  - Reject unsigned requests
- **Testing**: Only valid webhooks accepted
- **Status**: ✓

---

## Phase 8: Monitoring & Observability

### 8.1 Logging

#### Task 8.1.1: Implement Structured Logging
- **Description**: Set up Pino logger with structured logging
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `src/utils/logger.js`
- **Features**:
  - JSON structured logs
  - Log levels (debug, info, warn, error)
  - Context injection (groupId, userId, etc.)
  - Performance logging
  - No sensitive data logging (tokens, PATs)
- **Testing**: Logs output correctly, no sensitive data
- **Status**: ✓

### 8.2 Metrics

#### Task 8.2.1: Implement Prometheus Metrics
- **Description**: Set up Prometheus metrics collection
- **Complexity**: Medium
- **Dependencies**: Task 1.1.2
- **Affected Files**: `src/monitoring/metrics.js`
- **Metrics**:
  - `telegit_messages_processed_total` - Counter by status
  - `telegit_processing_duration_seconds` - Histogram
  - `telegit_active_operations` - Gauge
  - `telegit_github_api_calls_total` - Counter
  - `telegit_llm_tokens_total` - Counter
  - `telegit_queue_size` - Gauge
- **Testing**: Metrics exposed at `/metrics` endpoint
- **Status**: ✓

#### Task 8.2.2: Implement Metrics Middleware
- **Description**: Add metrics collection to key operations
- **Complexity**: Low
- **Dependencies**: Task 8.2.1
- **Affected Files**: `src/monitoring/middleware.js`
- **Integration Points**:
  - Message processing duration
  - GitHub API calls
  - LLM API calls
  - Queue operations
- **Testing**: Metrics update correctly during operations
- **Status**: ✓

### 8.3 Health Checks

#### Task 8.3.1: Implement Health Check Endpoint
- **Description**: Create health check endpoint for all services
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1, Task 3.1.1, Task 4.1.1, Task 5.1.1
- **Affected Files**: `src/api/health.js`
- **Checks**:
  - Telegram connection status
  - PostgreSQL connection status
  - LLM API status
  - GitHub MCP status
  - Queue health
- **Response Format**:
  ```json
  {
    "status": "healthy|degraded|critical",
    "version": "1.0.0",
    "uptime": 12345,
    "services": {
      "telegram": true,
      "github": true,
      "postgresql": true,
      "llm": true
    }
  }
  ```
- **Testing**: Health check returns correct status
- **Status**: ✓

### 8.4 Alerting

#### Task 8.4.1: Implement Alert Rules
- **Description**: Define alert rules for critical conditions
- **Complexity**: Low
- **Dependencies**: Task 8.2.1
- **Affected Files**: `src/monitoring/alerts.js`
- **Alert Rules**:
  - High error rate (>10% in 5 min)
  - Slow processing (p95 >10 sec)
  - GitHub rate limit low (<100 remaining)
  - LLM timeout spike (>5 in 5 min)
  - Queue backlog (>100 messages)
- **Testing**: Alerts trigger on threshold violations
- **Status**: ✓

---

## Phase 9: Deployment & Infrastructure

### 9.1 Docker

#### Task 9.1.1: Create Dockerfile
- **Description**: Create production Dockerfile
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `Dockerfile`
- **Requirements**:
  - Node.js 22 Alpine base
  - Production dependencies only
  - Multi-stage build for optimization
  - Non-root user
  - Health check
- **Testing**: Docker build succeeds, container runs
- **Status**: ✓

#### Task 9.1.2: Create Docker Compose
- **Description**: Create docker-compose for local development
- **Complexity**: Low
- **Dependencies**: Task 10.1.1
- **Affected Files**: `docker-compose.yml`
- **Services**:
  - telegit (main app)
  - postgres (PostgreSQL database)
  - Networks configuration
- **Testing**: `docker-compose up` works, PostgreSQL accessible
- **Status**: ✓

#### Task 9.1.3: Create .dockerignore
- **Description**: Create .dockerignore for build optimization
- **Complexity**: Low
- **Dependencies**: Task 10.1.1
- **Affected Files**: `.dockerignore`
- **Excludes**:
  - node_modules
  - test/
  - .git/
  - *.md (except critical ones)
  - .env files
- **Status**: ✓

### 9.2 Dokploy

#### Task 9.2.1: Create Dokploy Configuration
- **Description**: Create Dokploy deployment configuration
- **Complexity**: Low
- **Dependencies**: Task 10.1.1
- **Affected Files**: `dokploy.yaml`
- **Configuration**:
  - Docker deployment type
  - Environment variables
  - Secrets management
  - Health check endpoint
  - Resource limits
  - Auto-scaling settings
  - Domain and SSL
- **Status**: ✓

### 9.3 Kubernetes (Optional)

#### Task 9.3.1: Create Kubernetes Manifests
- **Description**: Create K8s deployment manifests
- **Complexity**: Medium
- **Dependencies**: Task 10.1.1
- **Affected Files**: `k8s/*.yaml`
- **Manifests**:
  - Namespace
  - ConfigMap
  - Secret
  - Deployment
  - Service
  - Ingress
  - HorizontalPodAutoscaler
  - PodDisruptionBudget
- **Testing**: `kubectl apply` succeeds, pods run
- **Status**: ✓

### 9.4 CI/CD

#### Task 9.4.1: Create GitHub Actions - Test Workflow
- **Description**: Create CI workflow for testing
- **Complexity**: Medium
- **Dependencies**: Task 1.1.5
- **Affected Files**: `.github/workflows/test.yml`
- **Steps**:
  - Checkout code
  - Setup Node.js 22
  - Install dependencies
  - Run linter
  - Run unit tests
  - Run integration tests
  - Upload coverage
- **Testing**: Workflow runs successfully on push
- **Status**: ✓

#### Task 9.4.2: Create GitHub Actions - Build Workflow
- **Description**: Create workflow for Docker image builds
- **Complexity**: Low
- **Dependencies**: Task 10.1.1
- **Affected Files**: `.github/workflows/build.yml`
- **Steps**:
  - Checkout code
  - Setup Docker buildx
  - Login to container registry
  - Build and push image
  - Tag with version
- **Testing**: Workflow builds and pushes image
- **Status**: ✓

#### Task 9.4.3: Create GitHub Actions - Deploy Workflow
- **Description**: Create workflow for automated deployment
- **Complexity**: Medium
- **Dependencies**: Task 10.4.2
- **Affected Files**: `.github/workflows/deploy.yml`
- **Steps**:
  - Trigger on successful build
  - Deploy to staging (auto)
  - Deploy to production (manual approval)
  - Run smoke tests
  - Rollback on failure
- **Testing**: Deployment workflow succeeds
- **Status**: ✓

### 9.5 Environment Setup

#### Task 9.5.1: Document Production Environment Setup
- **Description**: Create documentation for production environment setup
- **Complexity**: Low
- **Dependencies**: None
- **Affected Files**: `docs/deployment.md`
- **Documentation**:
  - Telegram bot creation
  - GitHub PAT setup
  - PostgreSQL database setup
  - LLM API setup
  - Environment variables
  - Secrets management
  - Initial deployment
- **Status**: ✓

---

## Phase 10: Documentation

### 10.1 API Documentation

#### Task 10.1.1: Document Internal APIs
- **Description**: Document internal API endpoints
- **Complexity**: Low
- **Dependencies**: Task 8.3.1, Task 5.2.3
- **Affected Files**: `docs/api.md`
- **Endpoints**:
  - `/api/health` - Health check
  - `/api/telegram-asset/:filePath` - Asset proxy
  - `/metrics` - Prometheus metrics
- **Status**: ✓

### 10.2 Architecture Documentation

#### Task 10.2.1: Create Architecture Diagram
- **Description**: Create detailed architecture diagram
- **Complexity**: Low
- **Dependencies**: None
- **Affected Files**: `docs/architecture.md`
- **Content**:
  - High-level architecture
  - Component interaction
  - Data flow diagrams
  - Deployment architecture
- **Status**: ✓

### 10.3 Operations Documentation

#### Task 10.3.1: Create Operations Runbook
- **Description**: Create runbook for operations team
- **Complexity**: Medium
- **Dependencies**: Task 8.4.1
- **Affected Files**: `docs/runbook.md`
- **Content**:
  - Common issues and solutions
  - Alert response procedures
  - Troubleshooting guide
  - Scaling procedures
  - Disaster recovery
- **Status**: ✓

### 10.4 User Documentation

#### Task 10.4.1: Update README with Usage Guide
- **Description**: Update README with comprehensive usage guide
- **Complexity**: Low
- **Dependencies**: None
- **Affected Files**: `README.md`
- **Content**:
  - Setup instructions
  - Bot commands
  - Usage examples
  - Emoji reference
  - FAQ
- **Status**: ✓

---

## Phase 11: Extensibility (Post-MVP)

### 11.1 Multi-Integration Support

#### Task 11.1.1: Create Base Execution Agent
- **Description**: Implement base execution agent class
- **Complexity**: Medium
- **Dependencies**: Task 4.4.1
- **Affected Files**: `src/agents/base-execution-agent.js`
- **Features**:
  - Abstract interface for all execution agents
  - Standard methods (initialize, parseIntent, executeCreate, executeUpdate, executeSearch)
  - Integration-agnostic design
- **Testing**: Base class can be extended
- **Status**: ✓

#### Task 11.1.2: Refactor GitHub Agent
- **Description**: Refactor GitHub integration as specialized execution agent
- **Complexity**: High
- **Dependencies**: Task 12.1.1, Task 5.2.1
- **Affected Files**: `src/agents/github-execution-agent.js`
- **Features**:
  - Extend BaseExecutionAgent
  - Implement all required methods
  - GitHub-specific parameter mapping
- **Testing**: GitHub agent works as before
- **Status**: ✓

#### Task 11.1.3: Implement Intent Processing Agent
- **Description**: Create intent processing agent separate from execution
- **Complexity**: High
- **Dependencies**: Task 12.1.1, Task 4.2.1
- **Affected Files**: `src/agents/intent-processing-agent.js`
- **Features**:
  - Parse user intent in abstract way
  - Hand off to execution agent
  - Integration-agnostic intent schema
- **Testing**: Intent agent hands off correctly
- **Status**: ✓

#### Task 11.1.4: Create Jira Execution Agent (Example)
- **Description**: Create Jira integration as example of extensibility
- **Complexity**: High
- **Dependencies**: Task 12.1.1
- **Affected Files**: `src/agents/jira-execution-agent.js`
- **Features**:
  - Extend BaseExecutionAgent
  - Jira API integration
  - Jira-specific parameter mapping
- **Testing**: Jira agent creates and updates issues
- **Status**: ✓

---

## Summary & Milestones

### Milestone 1: Foundation (Phase 1)
**Target**: Week 1
- Project scaffolded with full directory structure
- Dependencies installed and configured
- Test infrastructure ready (mocks, helpers)
- Development environment ready

### Milestone 2: Parallel Development Kickoff (After Phase 1)
**Target**: Week 1-3 (PARALLEL WORK BEGINS)
- **Critical Path**: Database schema + Telegram bot foundation
- **Parallel Track 1**: LLM setup + Intent classification
- **Parallel Track 2**: MCP client + GitHub tools setup
- **Parallel Track 3**: Rate limiters implemented
- **Parallel Track 4**: Core security (encryption, whitelists, sanitization)
- **Parallel Track 5**: Logging and metrics infrastructure

### Milestone 3: Core Integration (Phases 3-4-5 Complete)
**Target**: Week 4-5 (CONVERGENCE)
- Telegram bot fully operational with all handlers
- Complete AI workflow with LangGraph
- GitHub MCP integration working end-to-end
- Issues created and updated from Telegram
- Image attachments supported
- Undo functionality implemented
- Basic end-to-end flow complete with tests

### Milestone 4: Production Ready (Phases 6-8 Complete)
**Target**: Week 6-7
- Message queue integrated with all components
- Rate limiting enforced across all APIs
- All security measures in place
- Monitoring and logging operational
- Health checks for all services
- All tests passing (unit + integration + LLM eval)
- Code coverage >70%

### Milestone 5: Deployment (Phase 9-10)
**Target**: Week 7-8
- Docker images built and optimized
- CI/CD pipeline operational
- Deployed to staging environment
- Documentation complete
- Load testing performed

### Milestone 6: MVP Release
**Target**: Week 8 (With Parallelization) or Week 10 (Sequential)
- Deployed to production
- Monitoring active
- Alerting configured
- Initial user feedback collected
- Bug fixes and iterations

### Milestone 7: Extensibility (Phase 11)
**Target**: Post-MVP (Week 12+)
- Multi-integration architecture refactored
- Example integrations (Jira, etc.)
- Plugin documentation
- Community contributions enabled

---

## Task Dependency Graph (Parallel Opportunities)

### Linear View (Oversimplified - See Parallel View Below)
```
Phase 1 → Phase 2 → Phase 3 → Complete Integration → Deployment
```

### Detailed Parallel View

```
Phase 1: Project Setup & Test Infrastructure
├─────────────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│                 │                  │                  │                  │                  │
▼                 ▼                  ▼                  ▼                  ▼                  ▼
Phase 2:          Phase 4.1-4.2:    Phase 5.1-5.2.1:  Phase 6:           Phase 7.1-7.3.1:  Phase 8.1-8.2:
Database          LLM Setup &        MCP Client &      Rate Limiters     Security Core     Logging & Metrics
+ Tests           Intent Class.      GitHub Tools      (all 3)            (Encryption,      (Pino, Prometheus)
                  + Tests            + Basic Tests                        Whitelist,
                                                                          Sanitization)
                                                                          + Tests
│
▼
Phase 3: Telegram Bot + Tests
├────────────────┬──────────────────┐
│                │                  │
▼                ▼                  ▼
Phase 4.3-4.4:   Phase 5.2.2-5.2.4: Phase 7.3.2-7.4:
Complete AI      Image Processing   Schema Valid.
Workflow         & Undo Logic       & Webhook Sec.
+ Integration    + Tests            + Tests
Tests
│                │
└────────┬───────┘
         │
         ▼
Phase 6.2: Message Queue Integration
Phase 8.3: Health Checks (needs all services)
         │
         ▼
Phase 9: Deployment & Infrastructure
         │
         ▼
Phase 10: Documentation (can start anytime, finalize here)
         │
         ▼
Phase 11: Extensibility (Post-MVP)
```

### Parallelization Strategy

**🚀 Stage 1 - After Phase 1 (HIGHLY PARALLEL):**
Can work on **6 phases simultaneously**:
- **Phase 2**: PostgreSQL Database (Critical Path)
- **Phase 4.1-4.2**: LLM setup, Intent Classifier (Independent)
- **Phase 5.1-5.2.1**: MCP Client, GitHub Tools (Independent)
- **Phase 6**: All rate limiters (Independent)
- **Phase 7.1-7.3.1**: Encryption, Whitelists, Sanitization (Independent)
- **Phase 8.1-8.2**: Logging, Metrics (Independent)

**⚡ Stage 2 - After Phase 2 (MODERATE PARALLEL):**
Can work on **4 tracks simultaneously**:
- **Phase 3**: Telegram Bot (Critical Path)
- Continue **Phase 4.1-4.2** if not complete
- Continue **Phase 5** if not complete
- Continue **Phase 7-8** if not complete

**🔗 Stage 3 - After Phase 3 (CONVERGENCE):**
Can work on **3 tracks simultaneously**:
- **Phase 4.3-4.4**: Complete AI Workflow with LangGraph
- **Phase 5.2.2-5.2.4**: Image Processing, Telegram Asset Proxy, Undo
- **Phase 7.3.2-7.4**: Schema Validation, Webhook Security

**🎯 Stage 4 - Integration (SEQUENTIAL):**
- **Phase 6.2**: Message Queue Integration (needs all components)
- **Phase 8.3**: Health Checks (needs all services)

**📦 Stage 5 - Finalization (PARALLEL):**
Can work on **2 tracks simultaneously**:
- **Phase 9**: Deployment & Infrastructure
- **Phase 10**: Documentation (can overlap with all phases)

**🔮 Stage 6 - Post-MVP:**
- **Phase 11**: Extensibility

### Time Savings with Parallelization

**Without Parallel Work**: ~10-12 weeks (sequential)
**With Parallel Work**: ~6-8 weeks (with proper team distribution)

**Key Insight**: Phases 4-8 contain many independent components that only depend on Phase 1 (project setup). This allows for massive parallelization in early stages.

### Recommended Team Distribution (for parallel work)

**Solo Developer**: Follow critical path (Phase 1→2→3→4→5→6→7→8→9→10), implement supporting phases as needed.

**2 Developers**:
- Dev 1: Critical Path (Phases 1→2→3)
- Dev 2: After Phase 1, work on Phases 6, 7, 8 (Infrastructure & Security)
- Both: Converge on Phases 4-5 integration

**3-4 Developers**:
- Dev 1: Phases 1→2→3 (PostgreSQL Database & Telegram Bot)
- Dev 2: Phases 4.1-4.2→4.3-4.4 (AI Engine)
- Dev 3: Phases 5.1-5.2→complete (GitHub Integration)
- Dev 4: Phases 6, 7, 8 (Rate Limiting, Security, Monitoring)

**5+ Developers**:
- Dev 1: Phases 1→2 (Setup & PostgreSQL Database)
- Dev 2: Phase 3 (Telegram Bot)
- Dev 3: Phase 4 (AI Engine complete)
- Dev 4: Phase 5 (GitHub Integration complete)
- Dev 5: Phases 6, 7, 8 (Infrastructure, Security, Monitoring)
- Dev 6+: Phase 10 (Documentation), Phase 9 (DevOps), Testing support

**Note**: Tests are integrated within each phase, written alongside the code they test.

---

## Progress Tracking

**Total Tasks**: 120+ (including integrated tests)
**Completed**: 11 (Phase 1 complete, Phase 5.1-5.2.1 complete)
**In Progress**: 0
**Not Started**: 109+

**Estimated Timeline**:
- **Sequential Development**: 10-12 weeks to MVP
- **Parallel Development (3-4 devs)**: 6-8 weeks to MVP
- **Aggressive Parallel (5+ devs)**: 5-7 weeks to MVP

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Integration → Deployment (~5-6 weeks minimum)

**Parallelizable Work**: ~40-50% of tasks can be done in parallel after Phase 1

**Note**: Task count increased as tests are now individual tasks alongside implementation.

---

## Notes

- Tasks are designed to be individually implementable
- **Tests are integrated alongside implementation** - write tests immediately after (or during) feature development
- Each implementation task is followed by its corresponding test task(s)
- Dependencies must be completed before dependent tasks
- Complexity ratings help with effort estimation:
  - Low (L): 1-4 hours
  - Medium (M): 4-8 hours
  - High (H): 8-16 hours
- Regular code reviews recommended after each phase
- **Test-Driven Development (TDD) or test-alongside-development is the recommended approach**
- Unit tests validate individual components in isolation
- Integration tests validate end-to-end workflows
- LLM evaluation with Promptfoo should be continuous during Phase 4 development

---

**Last Updated**: 2025-11-18
**Version**: 2.3
**Status**: Phase 5 (MCP Integration) partially complete - Tasks 5.1.1, 5.1.2, and 5.2.1 implemented. Remaining tasks (5.2.2-5.2.4) blocked by incomplete Phase 2 and Phase 3 dependencies.
