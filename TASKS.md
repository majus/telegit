# TeleGit Development Tasks

This document provides a comprehensive breakdown of development tasks derived from PRD.md. Tasks are organized into logical phases with dependencies, complexity ratings, affected files, and testing requirements.

**Legend:**
- **Complexity**: Low (L) | Medium (M) | High (H)
- **Dependencies**: Tasks that must be completed first
- **Status**: ☐ Not Started | ⚠ In Progress | ✓ Complete

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
- **Status**: ☐

#### Task 1.1.2: Configure Package Dependencies
- **Description**: Set up package.json with all required dependencies
- **Complexity**: Medium
- **Dependencies**: Task 1.1.1
- **Affected Files**: `package.json`
- **Key Dependencies**:
  - Core: `telegraf`, `@supabase/supabase-js`, `bottleneck`
  - AI/LangChain: `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/mcp-adapters`
  - MCP SDK: `@modelcontextprotocol/sdk`
  - Testing: `vitest`, `@faker-js/faker`, `promptfoo`
  - Monitoring: `prom-client`, `pino`
  - Security: `crypto` (built-in)
- **Testing**: Run `npm install` successfully
- **Status**: ☐

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
- **Status**: ☐

#### Task 1.1.4: Environment Configuration Setup
- **Description**: Create environment variable templates and validation
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `.env.example`
  - `.env.test`
  - `src/config/env.js`
- **Environment Variables**:
  - `NODE_ENV`, `LOG_LEVEL`, `PORT`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_DOMAIN`, `TELEGRAM_WEBHOOK_SECRET`
  - `SUPABASE_URL`, `SUPABASE_KEY`
  - `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`
  - `MCP_GITHUB_ENDPOINT`, `MCP_TIMEOUT`
  - `ENCRYPTION_KEY`, `ALLOWED_GROUPS`, `ALLOWED_USERS`
  - Rate limit configs
- **Testing**: Environment validation catches missing variables
- **Status**: ☐

#### Task 1.1.5: Configure Vitest
- **Description**: Set up Vitest testing framework with configuration
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `vitest.config.js`
  - `test/setup.js`
- **Testing**: Run `npm test` successfully (with placeholder test)
- **Status**: ☐

#### Task 1.1.6: Configure Promptfoo for LLM Testing
- **Description**: Set up Promptfoo for LLM evaluation and testing
- **Complexity**: Medium
- **Dependencies**: Task 1.1.2
- **Affected Files**:
  - `promptfoo.config.yaml`
  - `prompts/intent-classification.txt`
  - `prompts/issue-extraction.txt`
- **Testing**: Run basic Promptfoo evaluation successfully
- **Status**: ☐

---

## Phase 2: Database & Data Layer

### 2.1 Database Schema

#### Task 2.1.1: Create Supabase Database Schema
- **Description**: Define and create database tables for group configs, operations, feedback, and context
- **Complexity**: Medium
- **Dependencies**: None
- **Affected Files**: `database/schema.sql`
- **Tables**:
  - `group_configs` - Telegram group configuration and GitHub credentials
  - `operations` - Operation history and tracking
  - `operation_feedback` - Feedback message tracking for auto-deletion
  - `conversation_context` - Cached conversation threads
- **Testing**: Schema applies without errors, constraints work
- **Status**: ☐

#### Task 2.1.2: Set Up Database Migrations
- **Description**: Create migration system for database schema versioning
- **Complexity**: Low
- **Dependencies**: Task 2.1.1
- **Affected Files**:
  - `database/migrations/001_initial_schema.sql`
  - `database/migrate.js`
- **Testing**: Migrations run successfully, rollback works
- **Status**: ☐

### 2.2 Data Access Layer

#### Task 2.2.1: Implement Supabase Client Setup
- **Description**: Create Supabase client initialization and connection management
- **Complexity**: Low
- **Dependencies**: Task 1.1.4, Task 2.1.1
- **Affected Files**: `src/database/supabase.js`
- **Testing**: Connection establishes successfully, environment variables loaded
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

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
- **Status**: ☐

### 8.3 Health Checks

#### Task 8.3.1: Implement Health Check Endpoint
- **Description**: Create health check endpoint for all services
- **Complexity**: Medium
- **Dependencies**: Task 2.2.1, Task 3.1.1, Task 4.1.1, Task 5.1.1
- **Affected Files**: `src/api/health.js`
- **Checks**:
  - Telegram connection status
  - Supabase connection status
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
      "supabase": true,
      "llm": true
    }
  }
  ```
- **Testing**: Health check returns correct status
- **Status**: ☐

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
- **Status**: ☐

---

## Phase 9: Testing & Quality Assurance

### 9.1 Unit Tests

#### Task 9.1.1: Unit Tests - Intent Classifier
- **Description**: Test intent classification with various message types
- **Complexity**: Medium
- **Dependencies**: Task 4.2.1
- **Affected Files**: `test/unit/ai/intent-classifier.test.js`
- **Test Cases**:
  - Bug reports identified correctly
  - Tasks identified correctly
  - Ideas identified correctly
  - Updates identified correctly
  - Unknown messages handled
  - Confidence scores appropriate
  - Entities extracted correctly
- **Status**: ☐

#### Task 9.1.2: Unit Tests - Message Filtering
- **Description**: Test message trigger detection
- **Complexity**: Low
- **Dependencies**: Task 3.1.2
- **Affected Files**: `test/unit/telegram/filters.test.js`
- **Test Cases**:
  - @mention detected
  - #hashtag detected
  - Non-triggered messages ignored
  - Whitelisting enforced
- **Status**: ☐

#### Task 9.1.3: Unit Tests - Encryption
- **Description**: Test token encryption/decryption
- **Complexity**: Low
- **Dependencies**: Task 7.1.1
- **Affected Files**: `test/unit/utils/encryption.test.js`
- **Test Cases**:
  - Encryption/decryption roundtrip
  - Tamper detection
  - Different IVs for same plaintext
- **Status**: ☐

#### Task 9.1.4: Unit Tests - Repositories
- **Description**: Test database repositories
- **Complexity**: Medium
- **Dependencies**: Task 2.2.2, Task 2.2.3, Task 2.2.4, Task 2.2.5
- **Affected Files**: `test/unit/database/repositories.test.js`
- **Test Cases**:
  - ConfigRepository CRUD operations
  - OperationsRepository CRUD operations
  - FeedbackRepository CRUD operations
  - ConversationContextRepository caching
- **Status**: ☐

#### Task 9.1.5: Unit Tests - Sanitization
- **Description**: Test input sanitization
- **Complexity**: Low
- **Dependencies**: Task 7.3.1
- **Affected Files**: `test/unit/utils/sanitize.test.js`
- **Test Cases**:
  - XSS attempts blocked
  - SQL injection attempts blocked
  - Normal input preserved
  - Markdown formatted correctly
- **Status**: ☐

### 9.2 Integration Tests

#### Task 9.2.1: Integration Tests - Telegram to GitHub Flow
- **Description**: Test end-to-end message processing flow
- **Complexity**: High
- **Dependencies**: Task 4.4.1
- **Affected Files**: `test/integration/telegram-github-flow.test.js`
- **Test Cases**:
  - Bug report creates GitHub issue
  - Task creates GitHub issue
  - Update finds and updates issue
  - Reactions update correctly
  - Feedback posted and scheduled for deletion
- **Status**: ☐

#### Task 9.2.2: Integration Tests - Auth Flow
- **Description**: Test GitHub authentication setup flow
- **Complexity**: High
- **Dependencies**: Task 3.2.2
- **Affected Files**: `test/integration/auth-flow.test.js`
- **Test Cases**:
  - Complete PAT setup flow
  - PAT validation
  - Invalid PAT handling
  - Retry logic
- **Status**: ☐

#### Task 9.2.3: Integration Tests - Reaction Controls
- **Description**: Test user reaction-based controls
- **Complexity**: Medium
- **Dependencies**: Task 3.1.5
- **Affected Files**: `test/integration/reaction-controls.test.js`
- **Test Cases**:
  - 👎 reaction triggers undo
  - 👍 reaction dismisses feedback
  - Undo reverts GitHub operation
- **Status**: ☐

### 9.3 LLM Evaluation

#### Task 9.3.1: Promptfoo - Intent Classification Tests
- **Description**: Evaluate intent classification accuracy with Promptfoo
- **Complexity**: Medium
- **Dependencies**: Task 4.2.2
- **Affected Files**: `test/promptfoo/intent-classification.yaml`
- **Test Cases**:
  - Bug detection accuracy
  - Task detection accuracy
  - Idea detection accuracy
  - Update detection accuracy
  - Entity extraction accuracy
  - Target: >80% accuracy overall
- **Status**: ☐

#### Task 9.3.2: Promptfoo - Issue Formatting Tests
- **Description**: Evaluate issue formatting quality with Promptfoo
- **Complexity**: Medium
- **Dependencies**: Task 4.3.6
- **Affected Files**: `test/promptfoo/issue-formatting.yaml`
- **Test Cases**:
  - Title quality
  - Body clarity
  - Label appropriateness
  - Markdown formatting
- **Status**: ☐

### 9.4 Test Helpers & Mocks

#### Task 9.4.1: Create Mock Data Generators
- **Description**: Create faker-based mock data generators
- **Complexity**: Low
- **Dependencies**: Task 1.1.2
- **Affected Files**: `test/helpers/factories.js`
- **Factories**:
  - Mock Telegram messages
  - Mock Telegram users
  - Mock Telegram groups
  - Mock GitHub issues
  - Mock LLM responses
- **Status**: ☐

#### Task 9.4.2: Create Test Bot Helper
- **Description**: Create helper for test bot instances
- **Complexity**: Medium
- **Dependencies**: Task 3.1.1
- **Affected Files**: `test/helpers/bot.js`
- **Features**:
  - Create isolated test bot
  - Mock Telegram API
  - Mock database
  - Mock LLM
- **Status**: ☐

---

## Phase 10: Deployment & Infrastructure

### 10.1 Docker

#### Task 10.1.1: Create Dockerfile
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
- **Status**: ☐

#### Task 10.1.2: Create Docker Compose
- **Description**: Create docker-compose for local development
- **Complexity**: Low
- **Dependencies**: Task 10.1.1
- **Affected Files**: `docker-compose.yml`
- **Services**:
  - telegit (main app)
  - Networks configuration
- **Testing**: `docker-compose up` works
- **Status**: ☐

#### Task 10.1.3: Create .dockerignore
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
- **Status**: ☐

### 10.2 Dokploy

#### Task 10.2.1: Create Dokploy Configuration
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
- **Status**: ☐

### 10.3 Kubernetes (Optional)

#### Task 10.3.1: Create Kubernetes Manifests
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
- **Status**: ☐

### 10.4 CI/CD

#### Task 10.4.1: Create GitHub Actions - Test Workflow
- **Description**: Create CI workflow for testing
- **Complexity**: Medium
- **Dependencies**: Task 1.1.5
- **Affected Files**: `.github/workflows/test.yml`
- **Steps**:
  - Checkout code
  - Setup Node.js 24
  - Install dependencies
  - Run linter
  - Run unit tests
  - Run integration tests
  - Upload coverage
- **Testing**: Workflow runs successfully on push
- **Status**: ☐

#### Task 10.4.2: Create GitHub Actions - Build Workflow
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
- **Status**: ☐

#### Task 10.4.3: Create GitHub Actions - Deploy Workflow
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
- **Status**: ☐

### 10.5 Environment Setup

#### Task 10.5.1: Document Production Environment Setup
- **Description**: Create documentation for production environment setup
- **Complexity**: Low
- **Dependencies**: None
- **Affected Files**: `docs/deployment.md`
- **Documentation**:
  - Telegram bot creation
  - GitHub PAT setup
  - Supabase setup
  - LLM API setup
  - Environment variables
  - Secrets management
  - Initial deployment
- **Status**: ☐

---

## Phase 11: Documentation

### 11.1 API Documentation

#### Task 11.1.1: Document Internal APIs
- **Description**: Document internal API endpoints
- **Complexity**: Low
- **Dependencies**: Task 8.3.1, Task 5.2.3
- **Affected Files**: `docs/api.md`
- **Endpoints**:
  - `/api/health` - Health check
  - `/api/telegram-asset/:filePath` - Asset proxy
  - `/metrics` - Prometheus metrics
- **Status**: ☐

### 11.2 Architecture Documentation

#### Task 11.2.1: Create Architecture Diagram
- **Description**: Create detailed architecture diagram
- **Complexity**: Low
- **Dependencies**: None
- **Affected Files**: `docs/architecture.md`
- **Content**:
  - High-level architecture
  - Component interaction
  - Data flow diagrams
  - Deployment architecture
- **Status**: ☐

### 11.3 Operations Documentation

#### Task 11.3.1: Create Operations Runbook
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
- **Status**: ☐

### 11.4 User Documentation

#### Task 11.4.1: Update README with Usage Guide
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
- **Status**: ☐

---

## Phase 12: Extensibility (Post-MVP)

### 12.1 Multi-Integration Support

#### Task 12.1.1: Create Base Execution Agent
- **Description**: Implement base execution agent class
- **Complexity**: Medium
- **Dependencies**: Task 4.4.1
- **Affected Files**: `src/agents/base-execution-agent.js`
- **Features**:
  - Abstract interface for all execution agents
  - Standard methods (initialize, parseIntent, executeCreate, executeUpdate, executeSearch)
  - Integration-agnostic design
- **Testing**: Base class can be extended
- **Status**: ☐

#### Task 12.1.2: Refactor GitHub Agent
- **Description**: Refactor GitHub integration as specialized execution agent
- **Complexity**: High
- **Dependencies**: Task 12.1.1, Task 5.2.1
- **Affected Files**: `src/agents/github-execution-agent.js`
- **Features**:
  - Extend BaseExecutionAgent
  - Implement all required methods
  - GitHub-specific parameter mapping
- **Testing**: GitHub agent works as before
- **Status**: ☐

#### Task 12.1.3: Implement Intent Processing Agent
- **Description**: Create intent processing agent separate from execution
- **Complexity**: High
- **Dependencies**: Task 12.1.1, Task 4.2.1
- **Affected Files**: `src/agents/intent-processing-agent.js`
- **Features**:
  - Parse user intent in abstract way
  - Hand off to execution agent
  - Integration-agnostic intent schema
- **Testing**: Intent agent hands off correctly
- **Status**: ☐

#### Task 12.1.4: Create Jira Execution Agent (Example)
- **Description**: Create Jira integration as example of extensibility
- **Complexity**: High
- **Dependencies**: Task 12.1.1
- **Affected Files**: `src/agents/jira-execution-agent.js`
- **Features**:
  - Extend BaseExecutionAgent
  - Jira API integration
  - Jira-specific parameter mapping
- **Testing**: Jira agent creates and updates issues
- **Status**: ☐

---

## Summary & Milestones

### Milestone 1: Foundation (Phases 1-2)
**Target**: Week 2
- Project scaffolded
- Dependencies installed
- Database schema created
- Development environment ready

### Milestone 2: Core Services (Phases 3-4)
**Target**: Week 4
- Telegram bot operational
- AI processing working
- LangGraph workflow functional
- Basic end-to-end flow complete

### Milestone 3: Integration (Phase 5)
**Target**: Week 5
- GitHub MCP integration working
- Issues created from Telegram
- Image attachments supported
- Undo functionality implemented

### Milestone 4: Production Ready (Phases 6-8)
**Target**: Week 7
- Rate limiting enforced
- Security measures in place
- Monitoring and logging operational
- Health checks working

### Milestone 5: Quality Assurance (Phase 9)
**Target**: Week 8
- Unit tests passing
- Integration tests passing
- LLM evaluation >80% accuracy
- Code coverage >70%

### Milestone 6: Deployment (Phase 10-11)
**Target**: Week 9
- Docker images built
- CI/CD pipeline operational
- Deployed to staging
- Documentation complete

### Milestone 7: MVP Release
**Target**: Week 10
- Deployed to production
- Monitoring active
- Initial user feedback collected

### Milestone 8: Extensibility (Phase 12)
**Target**: Post-MVP
- Multi-integration architecture
- Example integrations (Jira, etc.)
- Plugin documentation

---

## Task Dependency Graph (Critical Path)

```
Phase 1 (Setup)
  └─> Phase 2 (Database)
      └─> Phase 3 (Telegram Bot)
          └─> Phase 4 (AI Engine)
              └─> Phase 5 (GitHub Integration)
                  └─> Phase 6 (Rate Limiting)
                      └─> Phase 7 (Security)
                          └─> Phase 8 (Monitoring)
                              └─> Phase 9 (Testing)
                                  └─> Phase 10 (Deployment)
                                      └─> Phase 11 (Documentation)
                                          └─> Phase 12 (Extensibility)
```

---

## Progress Tracking

**Total Tasks**: 110+
**Completed**: 0
**In Progress**: 0
**Not Started**: 110+

**Estimated Timeline**: 10-12 weeks to MVP

---

## Notes

- Tasks are designed to be individually implementable
- Each task includes testing requirements
- Dependencies must be completed before dependent tasks
- Complexity ratings help with effort estimation:
  - Low (L): 1-4 hours
  - Medium (M): 4-8 hours
  - High (H): 8-16 hours
- Regular code reviews recommended after each phase
- Integration tests should be run after each major milestone
- LLM evaluation should be continuous throughout Phase 4

---

**Last Updated**: 2025-11-18
**Version**: 1.0
**Status**: Initial task breakdown complete
