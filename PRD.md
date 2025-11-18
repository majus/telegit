# TeleGit Product Requirements Document (PRD)
Version 1.0 | Date: November 2025

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [User Flows](#user-flows)
6. [API Specifications](#api-specifications)
7. [Security & Access Control](#security-access-control)
8. [Testing Strategy](#testing-strategy)
9. [Deployment & Infrastructure](#deployment-infrastructure)
10. [Monitoring & Observability](#monitoring-observability)

## Executive Summary

TeleGit is an AI-powered Telegram bot that transforms conversational messages into actionable GitHub issues through natural language processing. The system operates non-disruptively in team chat environments, using emoji reactions for status indication and temporary feedback messages that auto-delete to maintain chat cleanliness.

### Key Principles
- **Optimistic execution**: Performs actions without confirmation, allowing post-action correction
- **Non-disruptive UX**: Minimal chat pollution with auto-deleting feedback
- **Chat-first workflow**: Telegram as the single entry point for all operations
- **Extensible architecture**: Modular design for future integration targets beyond GitHub

### Technical Stack Overview
- **Runtime**: Node.js >= 22.0.0 (LTS) with JavaScript (TypeScript for types only)
- **AI Orchestration**: LangChain.js + LangGraph
- **Message Queue**: Bottleneck (in-memory rate limiting)
- **Storage**: Supabase (PostgreSQL)
- **Testing**: Vitest + @faker-js/faker + Promptfoo
- **Deployment**: Docker + Dokploy
- **Integrations**: Telegraf (Telegram), GitHub MCP over HTTP

## System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "User Layer"
        TG[Telegram Group Chat]
        U1[User 1]
        U2[User 2]
        U3[User N]
    end
    
    subgraph "Application Layer"
        TB[Telegram Bot<br/>Telegraf]
        MQ[Message Queue<br/>Bottleneck]
        AI[AI Processor<br/>LangChain + LangGraph<br/>with GitHub MCP Client]
        GH[GitHub MCP Server]
    end
    
    subgraph "Data Layer"
        SB[(Supabase<br/>PostgreSQL)]
        CACHE[In-Memory Cache]
    end
    
    subgraph "External Services"
        TAPI[Telegram API]
        LLMAPI[LLM API<br/>OpenAI/Anthropic]
        GHAPI[GitHub MCP Server]
    end
    
    U1 & U2 & U3 --> TG
    TG <--> TAPI
    TAPI <--> TB
    TB --> MQ
    MQ --> AI
    AI --> GH
    AI <--> LLMAPI
    GH <--> GHAPI
    TB <--> SB
    AI <--> SB
    AI <--> CACHE
```

### Component Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant Telegram
    participant Bot
    participant Queue
    participant AI
    participant MCP
    participant GitHub
    participant Supabase
    
    User->>Telegram: Send message with #tag/@mention
    Telegram->>Bot: Webhook/Polling
    Bot->>Supabase: Check GitHub auth for chat
    alt No GitHub authentication
        Bot->>User: Trigger PAT setup workflow (see Auth Flow diagram)
        Note over Bot,User: Authentication must be completed first
    else GitHub authentication exists
        Bot->>Bot: Validate trigger conditions
        Bot->>Telegram: React with 👀 (Analyzing)
        Bot->>Queue: Enqueue processing job
        Queue->>AI: Process message (rate limited)
        AI->>Supabase: Get GitHub auth for chat
        AI->>AI: Configure GitHub MCP client with PAT
        AI->>AI: Extract intent & classify
        AI->>Telegram: Update reaction to 🤔 (Processing)
        AI->>MCP: Execute GitHub operation
        MCP->>GitHub: API call (create/update issue)
        GitHub-->>MCP: Response
        MCP-->>AI: Operation result
        AI->>Supabase: Store operation record
        AI->>Telegram: Final reaction (👾/🫡/🦄/😵‍💫)
        AI->>Telegram: Post feedback message
        Bot->>Bot: Schedule message deletion (10 min)
    end
```

### GitHub Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Telegram
    participant Bot
    participant Supabase
    participant GitHub

    User->>Telegram: Send message in chat with #tag/@mention
    Telegram->>Bot: Webhook/Polling
    Bot->>Supabase: Check GitHub auth for chat
    Supabase-->>Bot: No authentication found

    Bot->>Telegram: Post auth required message in chat
    Bot->>User: Send DM with PAT setup instructions
    Note over Bot,User: Private chat for secure PAT exchange

    User->>Bot: Send /configure command in DM
    Bot->>User: Request GitHub PAT
    User->>Bot: Provides PAT + repository

    Bot->>Bot: Validate PAT format
    Bot->>GitHub: Test PAT & check permissions
    Note over Bot,GitHub: Validate scopes: repo, write:discussion<br/>Optional: read:org<br/>Check repo access & rate limits
    GitHub-->>Bot: Validation response

    alt Validation successful
        Bot->>Bot: Encrypt PAT (AES-256-GCM)
        Bot->>Supabase: Store encrypted PAT + repo for chat
        Bot->>User: Configuration successful
        Bot->>Telegram: Post success message in chat
        Note over Bot,Telegram: Bot ready to process messages
    else Validation failed
        Bot->>User: Error message with instructions
        Bot->>User: Request corrected PAT
        Note over Bot,User: Loop until valid or cancelled
    end
```

## Core Components

### 1. Telegram Bot Service (`/src/services/telegram`)

**Responsibilities:**
- WebHook/Polling management
- Message filtering and trigger detection
- Reaction management
- Feedback message lifecycle
- Group/user whitelisting

**Webhook vs Polling Decision:**

| Aspect | Webhooks (Production) | Polling (Development) |
|--------|----------------------|---------------------|
| **Use Case** | Production deployment with public HTTPS endpoint | Local development without public URL |
| **Latency** | Real-time (~100ms) | Polling interval (default 3s) |
| **Server Load** | Event-driven (low) | Continuous polling (higher) |
| **Requirements** | Public HTTPS URL, SSL certificate | None |
| **Reliability** | Telegram guarantees delivery | Client responsible for polling |
| **Setup Complexity** | Medium (webhook setup + signature verification) | Low (just start polling) |

**Implementation:**
```javascript
// bot.js - Environment-based mode selection
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

if (process.env.NODE_ENV === 'production') {
  // Production: Use webhooks
  const webhookDomain = process.env.TELEGRAM_WEBHOOK_URL;
  const webhookPath = '/webhook/telegram';

  app.use(bot.webhookCallback(webhookPath));

  bot.telegram.setWebhook(`${webhookDomain}${webhookPath}`, {
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET
  });

  logger.info('Telegram bot started in webhook mode', { webhookDomain });

} else {
  // Development: Use long polling
  bot.launch({
    dropPendingUpdates: true,
    allowedUpdates: ['message', 'callback_query', 'message_reaction']
  });

  logger.info('Telegram bot started in polling mode');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

**Webhook Security:**
- Validate `X-Telegram-Bot-Api-Secret-Token` header
- Use HTTPS only (Telegram requirement)
- Implement IP whitelisting for Telegram's server IPs
- Rate limit webhook endpoint to prevent abuse

**Key Files:**
```javascript
// bot.js - Main bot initialization
import { Telegraf } from 'telegraf';
import { bottleneck } from '../queue/bottleneck.js';
import { processMessage } from '../ai/processor.js';

// handlers.js - Message handling logic
export const handleMessage = async (ctx) => {
  // Trigger detection: @mention or #hashtag
  if (!shouldProcess(ctx.message)) return;
  
  // Add analyzing reaction
  await ctx.react('👀');
  
  // Queue for processing
  await messageQueue.schedule(() => processMessage(ctx));
};

// reactions.js - Reaction-based controls
export const handleReaction = async (ctx) => {
  const { emoji, message_id } = ctx.update.reaction;

  switch(emoji) {
    case '👎': await undoLastAction(message_id); break;
    case '👍': await dismissFeedback(message_id); break;
  }
};

// feedback-scheduler.js - Persistent auto-deletion
export async function scheduleFeedbackDeletion(messageId, chatId, operationId) {
  const deletionTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in database (survives bot restarts)
  await supabase.from('operation_feedback').insert({
    operation_id: operationId,
    feedback_message_id: messageId,
    scheduled_deletion: deletionTime,
    dismissed: false
  });

  // Schedule in-memory deletion (if bot stays alive)
  setTimeout(() => deleteFeedbackMessage(messageId, chatId), 10 * 60 * 1000);
}

// Startup: Resume pending deletions after bot restart
export async function resumePendingDeletions(bot) {
  const pending = await supabase
    .from('operation_feedback')
    .select('*')
    .eq('dismissed', false)
    .gt('scheduled_deletion', new Date().toISOString());

  for (const feedback of pending.data) {
    const delay = new Date(feedback.scheduled_deletion) - Date.now();
    if (delay > 0) {
      setTimeout(
        () => deleteFeedbackMessage(feedback.feedback_message_id, feedback.chat_id),
        delay
      );
    } else {
      // Already past deletion time - delete immediately
      await deleteFeedbackMessage(feedback.feedback_message_id, feedback.chat_id);
    }
  }
}
```

### 2. AI Processing Engine (`/src/ai`)

**Responsibilities:**
- Intent extraction and classification
- Context gathering (conversation threads)
- LangGraph workflow orchestration
- Tool execution coordination

**LangGraph Workflow:**

```mermaid
graph LR
    Start([Message Input]) --> Analyze[Analyze Intent]
    Analyze --> Decision{Intent Type?}
    
    Decision -->|Create| Create[Create Issue Node]
    Decision -->|Update| Search[Search Issues Node]
    Decision -->|Search| Search
    Decision -->|Unknown| Error[Error Handler]
    
    Create --> Format[Format Issue Node]
    Search --> Select[Select Issue Node]
    Select --> Update[Update Issue Node]
    
    Format --> Execute[Execute GitHub Op]
    Update --> Execute
    Execute --> Store[Store Result]
    Store --> Notify[Send Feedback]
    Notify --> End([Complete])
    
    Error --> ErrorNotify[Error Notification]
    ErrorNotify --> End
```

**Key Files:**
```javascript
// processor.js - Main AI processing
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { githubTools } from '../tools/github.js';

// workflow.js - LangGraph workflow definition
export const createWorkflow = () => {
  const workflow = new StateGraph({
    channels: {
      messages: { value: [], reducer: (a, b) => [...a, ...b] },
      intent: { value: null },
      context: { value: {} },
      result: { value: null },
      retryCount: { value: 0 }
    }
  });

  workflow.addNode('analyze', analyzeIntent);
  workflow.addNode('search', searchIssues);
  workflow.addNode('create', createIssue);
  workflow.addNode('update', updateIssue);
  workflow.addNode('errorHandler', handleError);

  workflow.addConditionalEdges('analyze', routeByIntent);

  return workflow.compile();
};

// Error recovery with exponential backoff
const retryConfig = {
  maxRetries: 3,
  retryableErrors: ['rate_limit', 'network_error', 'timeout'],
  backoff: (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000)
};

async function executeWithRetry(operation, state) {
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await operation(state);
    } catch (error) {
      if (!retryConfig.retryableErrors.includes(error.type) ||
          attempt === retryConfig.maxRetries) {
        throw error;
      }
      await new Promise(resolve =>
        setTimeout(resolve, retryConfig.backoff(attempt))
      );
    }
  }
}

// Idempotency: GitHub operations are idempotent via unique operation IDs
async function createIssue(state) {
  const operationId = state.telegramMessage.id;

  // Check if operation already completed (restart recovery)
  const existing = await db.operations.findByMessageId(operationId);
  if (existing?.status === 'completed') {
    return existing.result;
  }

  // Execute with automatic retry
  return executeWithRetry(async () => {
    const result = await githubMCP.createIssue({
      ...state.githubOperation.data,
      // Include message ID in issue body for deduplication
      body: `${state.githubOperation.data.body}\n\n<!-- telegit:${operationId} -->`
    });

    // Store result for idempotency
    await db.operations.update(operationId, {
      status: 'completed',
      result
    });

    return result;
  }, state);
}

// intents.js - Intent classification
const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { 
      enum: ['create_bug', 'create_task', 'create_idea', 
              'update_issue', 'search_issues', 'unknown']
    },
    confidence: { type: 'number', min: 0, max: 1 },
    entities: {
      title: { type: 'string' },
      description: { type: 'string' },
      labels: { type: 'array', items: { type: 'string' } },
      assignees: { type: 'array', items: { type: 'string' } }
    }
  }
};
```

### 3. GitHub MCP Integration (`/src/integrations/github`)

**Responsibilities:**
- MCP server communication via LangChain MCP adapter
- Tool invocation and response handling
- Image attachment processing
- Error handling and retries

**Key Files:**
```javascript
// mcp-adapter.js - LangChain MCP adapter setup
import { wrapMCPServer } from '@langchain/mcp-adapters';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export async function createGitHubMCPTools(config) {
  // Create MCP client with SSE transport
  const transport = new SSEClientTransport(
    new URL(config.mcpEndpoint)
  );

  const client = new Client({
    name: 'telegit-client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  await client.connect(transport);

  // Wrap MCP server as LangChain tools using official adapter
  const tools = await wrapMCPServer({
    client,
    // Optional: filter specific tools
    includeTools: [
      'github_create_issue',
      'github_update_issue',
      'github_search_issues'
    ]
  });

  return tools;
}

// image-processor.js - Telegram image processing
/**
 * Image Upload Strategy: GitHub Issue Attachments API
 *
 * Telegram images are downloaded from Telegram servers and re-uploaded
 * to GitHub using the issue attachments API (multipart/form-data).
 *
 * Alternative considered but rejected:
 * - Base64 encoding: Bloats issue body, hard to read
 * - External CDN: Requires additional infrastructure
 */
export async function processBodyWithImages(data, telegramBot, githubRepo) {
  const imageRegex = /https:\/\/api\.telegram\.org\/file\/bot[^\/]+\/(.+)/g;
  let body = data.body;
  const matches = [...body.matchAll(imageRegex)];

  for (const match of matches) {
    const telegramUrl = match[0];

    try {
      // 1. Download image from Telegram
      const response = await fetch(telegramUrl);
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type');
      const filename = match[1].split('/').pop();

      // 2. Upload to GitHub via issue attachments API
      // Note: This requires the image to be uploaded as an asset first
      const formData = new FormData();
      formData.append('file', new Blob([buffer], { type: contentType }), filename);

      const uploadResponse = await fetch(
        `https://api.github.com/repos/${githubRepo}/issues/attachments`,
        {
          method: 'POST',
          headers: {
            Authorization: `token ${githubPAT}`,
            Accept: 'application/vnd.github+json'
          },
          body: formData
        }
      );

      const { url: githubImageUrl } = await uploadResponse.json();

      // 3. Replace Telegram URL with GitHub URL in markdown
      body = body.replace(telegramUrl, githubImageUrl);

    } catch (error) {
      logger.error('Failed to upload image', { error, telegramUrl });
      // Keep original URL if upload fails
    }
  }

  return body;
}
```

### 4. Rate Limiting Queue (`/src/queue`)

**Responsibilities:**
- API rate limit enforcement
- Priority queue management
- Retry logic with exponential backoff
- Concurrent operation control

**MVP Limitation:**
> **IMPORTANT**: The current Bottleneck implementation uses in-memory state, which means rate limits are per-instance. In distributed deployments (multiple Kubernetes replicas), each instance maintains separate rate limit counters, effectively multiplying the total request rate. For MVP, deploy as a single replica (`replicas: 1` in Kubernetes). Post-MVP, migrate to Redis-backed rate limiting using `bottleneck/ioredis` for shared state across replicas.

**Configuration:**
```javascript
// bottleneck.js
import Bottleneck from 'bottleneck';

// Telegram rate limits
export const telegramLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 34, // ~30 msgs/sec
  reservoir: 30,
  reservoirRefreshAmount: 30,
  reservoirRefreshInterval: 1000
});

// GitHub rate limits (5000/hour = ~83/min)
export const githubLimiter = new Bottleneck({
  maxConcurrent: 2,
  minTime: 720, // ~83 requests/min
  reservoir: 100,
  reservoirRefreshAmount: 83,
  reservoirRefreshInterval: 60 * 1000
});

// LLM rate limits (vary by provider)
export const llmLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 200,
  reservoir: 50,
  reservoirRefreshAmount: 50,
  reservoirRefreshInterval: 60 * 1000
});
```

### 5. Data Persistence Layer (`/src/database`)

**Responsibilities:**
- Configuration storage
- Operation history
- User preferences
- Conversation context caching

**Key Files:**
```javascript
// supabase.js - Database client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// repositories/config.js
export class ConfigRepository {
  async getGroupConfig(groupId) {
    const { data, error } = await supabase
      .from('group_configs')
      .select('*')
      .eq('telegram_group_id', groupId)
      .single();
    
    return data;
  }
  
  async setGroupConfig(groupId, config) {
    return supabase
      .from('group_configs')
      .upsert({
        telegram_group_id: groupId,
        github_repo: config.repo,
        github_token: this.encrypt(config.token),
        manager_user_id: config.managerId,
        updated_at: new Date().toISOString()
      });
  }
}
```

## Data Models

### Database Schema

```mermaid
erDiagram
    group_configs ||--o{ operations : has
    group_configs ||--o{ whitelist_entries : has
    operations ||--o{ operation_feedback : has
    
    group_configs {
        bigint telegram_group_id PK
        string github_repo
        string encrypted_github_token
        bigint manager_user_id
        jsonb settings
        timestamp created_at
        timestamp updated_at
    }
    
    operations {
        uuid id PK
        bigint telegram_group_id FK
        bigint telegram_message_id
        string operation_type
        string github_issue_url
        jsonb operation_data
        string status
        timestamp created_at
    }
    
    operation_feedback {
        uuid id PK
        uuid operation_id FK
        bigint feedback_message_id
        timestamp scheduled_deletion
        boolean dismissed
        timestamp created_at
    }
    
    whitelist_entries {
        uuid id PK
        bigint telegram_group_id FK
        bigint telegram_user_id
        string permission_level
        timestamp created_at
    }
    
    conversation_context {
        uuid id PK
        bigint telegram_group_id
        bigint thread_root_message_id
        jsonb messages_chain
        timestamp cached_at
        timestamp expires_at
    }
```

### Database Migration Strategy

**Tool**: Supabase Migrations (native PostgreSQL migrations)

**Migration Workflow:**
```bash
# Create new migration
npx supabase migration new add_key_versioning

# Apply migrations locally
npx supabase db push

# Apply migrations to production (via Supabase CLI)
npx supabase db push --linked
```

**Example Migration:**
```sql
-- migrations/20250118000001_initial_schema.sql
CREATE TABLE group_configs (
  telegram_group_id BIGINT PRIMARY KEY,
  github_repo TEXT NOT NULL,
  encrypted_github_token TEXT NOT NULL,
  encryption_key_version INTEGER NOT NULL DEFAULT 1,
  manager_user_id BIGINT NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_group_configs_updated ON group_configs(updated_at);

-- Additional tables following database schema above
-- (operations, operation_feedback, whitelist_entries, conversation_context)
```

**CI/CD Integration:**
- Migrations run automatically in CI/CD pipeline before deployment
- Use `supabase db diff` to generate migrations from schema changes
- Version control all migrations in `/supabase/migrations/`
- Rollback procedure: Create reverse migration or use `supabase db reset`

### State Management

```javascript
// LangGraph State Schema
const WorkflowState = {
  // Input
  telegramMessage: {
    id: Number,
    text: String,
    from: Object,
    chat: Object,
    reply_to_message: Object,
    entities: Array
  },
  
  // Processing
  intent: {
    type: String,
    confidence: Number,
    entities: Object
  },
  
  conversationContext: Array, // Previous messages in thread
  
  // GitHub Operation
  githubOperation: {
    type: String, // 'create' | 'update' | 'search'
    repository: String,
    data: Object
  },
  
  // Result
  result: {
    success: Boolean,
    githubUrl: String,
    error: String
  },
  
  // Metadata
  timestamps: {
    received: Date,
    processed: Date,
    completed: Date
  }
};
```

## User Flows

### 1. Initial Bot Setup Flow

```mermaid
stateDiagram-v2
    [*] --> AddToGroup: Admin adds bot to group
    AddToGroup --> SendWelcome: Bot sends welcome message
    SendWelcome --> DMAdmin: Admin DMs bot
    DMAdmin --> ConfigureRepo: Admin provides GitHub PAT & repo
    ConfigureRepo --> ValidateConfig: Bot validates credentials
    ValidateConfig --> StoreConfig: Validation successful
    ValidateConfig --> RequestCorrection: Validation failed
    RequestCorrection --> ConfigureRepo
    StoreConfig --> Ready: Bot ready in group
    Ready --> [*]
```

### 2. Message Processing Flow

```mermaid
flowchart TD
    Start([User sends message]) --> Check{Has trigger?}
    Check -->|No| Ignore[Ignore message]
    Check -->|Yes| React1[React: 👀]
    
    React1 --> CheckReply{Is reply?}
    CheckReply -->|Yes| Gather[Gather conversation thread]
    CheckReply -->|No| Process[Process single message]
    
    Gather --> Process
    Process --> AI[AI Analysis]
    AI --> React2[React: 🤔]
    
    AI --> IntentCheck{Intent recognized?}
    IntentCheck -->|No| Error[React: 😵‍💫]
    IntentCheck -->|Yes| Execute[Execute GitHub operation]
    
    Execute --> Success{Success?}
    Success -->|No| Error
    Success -->|Yes| Final[React: 👾/🫡/🦄]
    
    Final --> Feedback[Post feedback message]
    Feedback --> Timer[Start 10-min timer]
    Timer --> Delete[Auto-delete feedback]
    
    Error --> ErrorMsg[Post error message]
    ErrorMsg --> Timer
    
    Ignore --> End([End])
    Delete --> End
```

### 3. Reaction Control Flow

```mermaid
flowchart LR
    User[User] --> React{Reaction type?}
    React -->|👎 on feedback| Undo[Undo last operation]
    React -->|👍 on feedback| Dismiss[Delete feedback immediately]
    
    Undo --> FindOp[Find operation record]
    FindOp --> Revert[Revert GitHub action]
    Revert --> Update[Update feedback message]
    
    Dismiss --> Delete[Delete feedback message]
    Delete --> Clear[Clear deletion timer]
```

## API Specifications

### Telegram Webhook

```javascript
// POST /webhook/telegram
{
  update_id: Number,
  message: {
    message_id: Number,
    from: { id: Number, username: String },
    chat: { id: Number, type: String },
    date: Number,
    text: String,
    entities: Array,
    reply_to_message: Object
  }
}

// Response
{
  status: 'processed' | 'ignored',
  trigger: String // What triggered processing
}
```

### Internal API Endpoints

```javascript
// GET /api/health
Response: { 
  status: 'healthy', 
  version: String,
  uptime: Number,
  services: {
    telegram: Boolean,
    github: Boolean,
    supabase: Boolean,
    llm: Boolean
  }
}

// POST /api/admin/configure
Request: {
  groupId: String,
  githubToken: String,
  repository: String
}
Response: {
  success: Boolean,
  message: String
}

// GET /api/stats/:groupId
Response: {
  totalOperations: Number,
  operationsByType: Object,
  last24Hours: Array,
  topUsers: Array
}
```

### GitHub MCP Tool Schemas

```javascript
// create_issue tool
{
  name: 'github_create_issue',
  parameters: {
    repository: String, // "owner/repo"
    title: String,
    body: String,
    labels: [String],
    assignees: [String],
    milestone: Number
  }
}

// update_issue tool
{
  name: 'github_update_issue',
  parameters: {
    repository: String,
    issue_number: Number,
    title: String,
    body: String,
    state: 'open' | 'closed',
    labels: [String],
    assignees: [String]
  }
}

// search_issues tool
{
  name: 'github_search_issues',
  parameters: {
    repository: String,
    query: String, // GitHub search syntax
    sort: 'created' | 'updated' | 'comments',
    order: 'asc' | 'desc',
    per_page: Number,
    page: Number
  }
}
```

## Security & Access Control

### GitHub PAT Validation Requirements

**Required Scopes:**
- `repo` - Full control of private repositories (includes issue management)
- `write:discussion` - Write access to discussions

**Optional Scopes:**
- `read:org` - Read organization membership (for team assignments)

**Validation Checks:**
```javascript
// src/security/pat-validator.js
export async function validateGitHubPAT(pat, repository) {
  // 1. Format validation
  if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
    throw new Error('Invalid PAT format');
  }

  // 2. Scope validation
  const scopesResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${pat}` }
  });

  const scopes = scopesResponse.headers.get('x-oauth-scopes')?.split(', ') || [];
  const requiredScopes = ['repo'];

  if (!requiredScopes.every(scope => scopes.includes(scope))) {
    throw new Error(`Missing required scopes. Need: ${requiredScopes.join(', ')}`);
  }

  // 3. Repository access validation
  const [owner, repo] = repository.split('/');
  const repoResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    { headers: { Authorization: `token ${pat}` } }
  );

  if (repoResponse.status === 404) {
    throw new Error('Repository not found or PAT lacks access');
  }

  // 4. Rate limit check (ensure PAT is not exhausted)
  const rateLimitResponse = await fetch(
    'https://api.github.com/rate_limit',
    { headers: { Authorization: `token ${pat}` } }
  );
  const rateLimit = await rateLimitResponse.json();

  if (rateLimit.resources.core.remaining < 100) {
    throw new Error('PAT rate limit nearly exhausted');
  }

  return {
    valid: true,
    scopes,
    rateLimit: rateLimit.resources.core
  };
}
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Bot
    participant Supabase
    participant GitHub
    
    User->>Bot: /configure command in DM
    Bot->>User: Request GitHub PAT
    User->>Bot: Provides PAT + repo
    Bot->>Bot: Encrypt PAT
    Bot->>GitHub: Validate token & permissions
    GitHub-->>Bot: Token valid + scopes
    Bot->>Supabase: Store encrypted config
    Bot->>User: Configuration complete
```

### Security Measures

1. **Token Management**
   - GitHub PATs encrypted at rest (AES-256-GCM)
   - Tokens never logged or exposed in responses
   - Automatic token rotation reminders

   **Encryption Key Management:**
   - **Key Derivation**: Use Argon2id for deriving encryption keys from master secret
     ```javascript
     import argon2 from 'argon2';

     const deriveKey = async (masterSecret, salt) => {
       return await argon2.hash(masterSecret, {
         type: argon2.argon2id,
         memoryCost: 2 ** 16, // 64MB
         timeCost: 3,
         parallelism: 1,
         hashLength: 32,
         salt: Buffer.from(salt, 'hex')
       });
     };
     ```

   - **Key Versioning**: Store key version with encrypted data for rotation support
     ```javascript
     // Encrypted data format: version:nonce:ciphertext:tag
     const encryptedFormat = `${keyVersion}:${nonce}:${ciphertext}:${authTag}`;
     ```

   - **Key Rotation Procedure**:
     1. Generate new encryption key (increment version)
     2. Deploy new key alongside old key in key store
     3. Run migration script to re-encrypt all PATs with new key
     4. Update key version in application config
     5. Deprecate old key after migration completion

   - **Production Key Storage**:
     - **Recommended**: AWS KMS, HashiCorp Vault, or Google Cloud KMS
     - **Minimum**: Store master secret in Kubernetes secrets with encryption at rest
     - **Never**: Hardcode keys in source code or .env files

   - **Key Material Requirements**:
     - Master secret: 32 bytes (256 bits) of cryptographically random data
     - Salt: 16 bytes unique per encryption operation
     - Nonce: 12 bytes unique per encryption operation

2. **Access Control**
   - Whitelist-based group/user filtering
   - Manager-only configuration changes
   - Rate limiting per user and group

3. **Input Validation**
   - Sanitize all Telegram input
   - Validate GitHub API responses
   - LLM output validation against schemas

4. **Network Security**
   - HTTPS only for webhooks
   - Webhook signature verification
   - IP whitelisting for production

## TypeScript Configuration

**Approach**: TypeScript for type definitions only, JavaScript for implementation

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.js", "src/**/*.d.ts", "test/**/*.js"],
  "exclude": ["node_modules", "dist"]
}
```

**Type Definition Strategy:**
- Use JSDoc comments for inline type annotations in `.js` files
- Create `.d.ts` files for complex types and interfaces
- Example:
  ```javascript
  // src/types/telegram.d.ts
  export interface TelegramMessage {
    message_id: number;
    from: TelegramUser;
    chat: TelegramChat;
    text?: string;
    entities?: TelegramEntity[];
  }

  // src/handlers/message.js
  /**
   * @param {import('../types/telegram').TelegramMessage} message
   * @returns {Promise<void>}
   */
  export async function handleMessage(message) {
    // Implementation
  }
  ```

**CI/CD Type Checking:**
```yaml
# .github/workflows/ci.yml
- name: Type Check
  run: npx tsc --noEmit
```

## Testing Strategy

**Coverage Targets:**
- Overall line coverage: **80%** minimum
- Critical paths (AI processing, GitHub integration): **90%** minimum
- Utilities and helpers: **70%** minimum

### Unit Testing Structure

```javascript
// test/unit/ai/intent-classifier.test.js
import { describe, it, expect, vi } from 'vitest';
import { classifyIntent } from '../../../src/ai/intent-classifier.js';

describe('Intent Classifier', () => {
  it('should identify bug report with high confidence', async () => {
    const message = 'Found a bug: login button not working #bug';
    const result = await classifyIntent(message);
    
    expect(result.intent).toBe('create_bug');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.entities.labels).toContain('bug');
  });
});
```

### LLM Evaluation with Promptfoo

```yaml
# promptfoo.config.yaml
providers:
  - openai:gpt-4
  - anthropic:claude-3

prompts:
  - file://prompts/intent-classification.txt

tests:
  - description: Bug report detection
    vars:
      message: "The API returns 500 errors when filtering by date #bug"
    assert:
      - type: javascript
        value: output.intent === 'create_bug'
      - type: llm-rubric
        value: "The intent should be classified as bug with high confidence"
        
  - description: Task creation
    vars:
      message: "Need to implement user authentication #todo"
    assert:
      - type: javascript
        value: output.intent === 'create_task'
      - type: llm-rubric
        value: "Task should be identified with relevant technical details"
```

### Integration Testing

```javascript
// test/integration/telegram-github-flow.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { faker } from '@faker-js/faker';
import { createTestBot } from '../helpers/bot.js';
import { mockTelegramMessage } from '../mocks/telegram.js';

describe('Telegram to GitHub Flow', () => {
  let bot, mockGroup;
  
  beforeAll(async () => {
    bot = await createTestBot();
    mockGroup = {
      id: faker.number.int({ min: -1000000000000 }),
      title: faker.company.name()
    };
  });
  
  it('should create GitHub issue from bug report', async () => {
    const message = mockTelegramMessage({
      text: `${faker.lorem.sentence()} #bug`,
      chat: mockGroup
    });
    
    const result = await bot.processMessage(message);
    
    expect(result.reactions).toContain('👾');
    expect(result.githubUrl).toMatch(/github\.com\/.*\/issues\/\d+/);
    expect(result.feedbackMessage).toBeDefined();
  });
});
```

## Deployment & Infrastructure

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:24-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY src ./src
COPY config ./config

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node healthcheck.js

# Start
CMD ["node", "src/index.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  telegit:
    build: .
    environment:
      NODE_ENV: production
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      LLM_API_KEY: ${LLM_API_KEY}
      MCP_GITHUB_ENDPOINT: http://mcp-server:3001
    ports:
      - "3000:3000"
    restart: unless-stopped
    depends_on:
      - redis
      - mcp-server
    networks:
      - telegit-network

  # GitHub MCP Server - provides GitHub API integration via MCP protocol
  # See: https://github.com/github/github-mcp-server
  mcp-server:
    image: ghcr.io/github/github-mcp-server:latest
    environment:
      PORT: 3001
      # GitHub PATs are provided per-request via Authorization header
      # from TeleGit's encrypted storage, not as env vars
    ports:
      - "3001:3001"
    restart: unless-stopped
    networks:
      - telegit-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - telegit-network

volumes:
  redis-data:

networks:
  telegit-network:
    driver: bridge
```

**MCP Server Authentication:**
The GitHub MCP server does NOT use a static PAT from environment variables. Instead, TeleGit configures the MCP client on a per-request basis with the decrypted PAT for the specific Telegram group making the request. This allows multiple groups to use different GitHub repositories with different credentials.

### Dokploy Deployment

```yaml
# dokploy.yaml
name: telegit
type: docker
dockerfile: ./Dockerfile

environment:
  - NODE_ENV=production
  - PORT=3000

secrets:
  - TELEGRAM_BOT_TOKEN
  - SUPABASE_URL
  - SUPABASE_KEY
  - LLM_API_KEY
  - ENCRYPTION_KEY

healthcheck:
  path: /api/health
  interval: 30s
  timeout: 10s

resources:
  memory: 512MB
  cpu: 0.5

autoscaling:
  min: 1
  max: 3
  target_cpu: 70

domains:
  - domain: telegit.yourdomain.com
    ssl: true

monitoring:
  enabled: true
  metrics_path: /metrics
```

### Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: telegit
  labels:
    app: telegit
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: telegit-config
  namespace: telegit
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "3000"
---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: telegit-secrets
  namespace: telegit
type: Opaque
stringData:
  TELEGRAM_BOT_TOKEN: "" # Set via kubectl or external secrets operator
  SUPABASE_URL: ""
  SUPABASE_KEY: ""
  LLM_API_KEY: ""
  ENCRYPTION_KEY: ""
  TELEGRAM_WEBHOOK_SECRET: ""
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telegit
  namespace: telegit
  labels:
    app: telegit
spec:
  replicas: 2
  selector:
    matchLabels:
      app: telegit
  template:
    metadata:
      labels:
        app: telegit
    spec:
      containers:
      - name: telegit
        image: telegit:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        envFrom:
        - configMapRef:
            name: telegit-config
        - secretRef:
            name: telegit-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: telegit
  namespace: telegit
  labels:
    app: telegit
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: telegit
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: telegit
  namespace: telegit
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - telegit.yourdomain.com
    secretName: telegit-tls
  rules:
  - host: telegit.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: telegit
            port:
              number: 80
---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: telegit
  namespace: telegit
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: telegit
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
# k8s/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: telegit
  namespace: telegit
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: telegit
```

### Environment Configuration

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=info

# Telegram
TELEGRAM_BOT_TOKEN=bot_token_here
TELEGRAM_WEBHOOK_URL=https://telegit.yourdomain.com/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=random_secret_here

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=service_role_key_here

# LLM Provider
LLM_PROVIDER=openai
LLM_API_KEY=sk-xxxxx
LLM_MODEL=gpt-4-turbo

# GitHub MCP
MCP_GITHUB_ENDPOINT=http://mcp-server:8080
MCP_TIMEOUT=30000

# Security
ENCRYPTION_KEY=32_byte_hex_key
ALLOWED_GROUPS=-1001234567890,-1009876543210
ALLOWED_USERS=123456789,987654321

# Rate Limits
RATE_LIMIT_TELEGRAM_PER_SECOND=30
RATE_LIMIT_GITHUB_PER_HOUR=5000
RATE_LIMIT_LLM_PER_MINUTE=50
```

## Monitoring & Observability

### Metrics Collection

```javascript
// src/monitoring/metrics.js
import { register, Counter, Histogram, Gauge } from 'prom-client';

export const metrics = {
  messagesProcessed: new Counter({
    name: 'telegit_messages_processed_total',
    help: 'Total messages processed',
    labelNames: ['group_id', 'intent_type', 'status']
  }),
  
  processingDuration: new Histogram({
    name: 'telegit_processing_duration_seconds',
    help: 'Message processing duration',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),
  
  activeOperations: new Gauge({
    name: 'telegit_active_operations',
    help: 'Currently active operations',
    labelNames: ['type']
  }),
  
  githubApiCalls: new Counter({
    name: 'telegit_github_api_calls_total',
    help: 'GitHub API calls',
    labelNames: ['operation', 'status']
  }),
  
  llmTokensUsed: new Counter({
    name: 'telegit_llm_tokens_total',
    help: 'LLM tokens consumed',
    labelNames: ['model', 'operation']
  })
};
```

### Logging Strategy

```javascript
// src/utils/logger.js
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'telegit',
    version: process.env.npm_package_version 
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Structured logging example
logger.info('Message processed', {
  groupId: message.chat.id,
  userId: message.from.id,
  intent: result.intent,
  confidence: result.confidence,
  githubIssue: result.issueNumber,
  processingTime: endTime - startTime
});
```

### Health Monitoring

```mermaid
graph TD
    HC[Health Check Endpoint] --> T[Telegram Connection]
    HC --> G[GitHub MCP Status]
    HC --> S[Supabase Connection]
    HC --> L[LLM API Status]
    HC --> Q[Queue Health]
    
    T --> TS{Status}
    G --> GS{Status}
    S --> SS{Status}
    L --> LS{Status}
    Q --> QS{Status}
    
    TS -->|Healthy| OK[Overall: Healthy]
    TS -->|Unhealthy| DEG[Overall: Degraded]
    
    GS -->|Healthy| OK
    GS -->|Unhealthy| DEG
    
    SS -->|Healthy| OK
    SS -->|Unhealthy| CRIT[Overall: Critical]
    
    LS -->|Healthy| OK
    LS -->|Unhealthy| DEG
    
    QS -->|Healthy| OK
    QS -->|Unhealthy| DEG
```

### Alert Configuration

```javascript
// src/monitoring/alerts.js
export const alertRules = {
  highErrorRate: {
    condition: 'rate(telegit_messages_processed_total{status="error"}[5m]) > 0.1',
    severity: 'warning',
    message: 'Error rate exceeds 10% in last 5 minutes',
    threshold: 0.1
  },

  slowProcessing: {
    condition: 'histogram_quantile(0.95, telegit_processing_duration_seconds) > 10',
    severity: 'warning',
    message: '95th percentile processing time exceeds 10 seconds',
    threshold: 10
  },

  githubRateLimit: {
    condition: 'telegit_github_rate_limit_remaining < 100',
    severity: 'critical',
    message: 'GitHub API rate limit nearly exhausted',
    threshold: 100
  },

  llmTimeout: {
    condition: 'rate(telegit_llm_timeouts_total[5m]) > 5',
    severity: 'warning',
    message: 'Multiple LLM API timeouts detected',
    threshold: 5
  },

  queueBacklog: {
    condition: 'telegit_queue_size > 100',
    severity: 'warning',
    message: 'Message queue backlog growing',
    threshold: 100
  }
};
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "TeleGit Monitoring",
    "panels": [
      {
        "title": "Message Processing Rate",
        "targets": [{
          "expr": "rate(telegit_messages_processed_total[5m])",
          "legendFormat": "{{intent_type}} - {{status}}"
        }],
        "type": "graph"
      },
      {
        "title": "Processing Duration (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, telegit_processing_duration_seconds)"
        }],
        "type": "graph"
      },
      {
        "title": "GitHub API Rate Limit",
        "targets": [{
          "expr": "telegit_github_rate_limit_remaining",
          "legendFormat": "Remaining requests"
        }],
        "type": "graph",
        "alert": {
          "conditions": [{
            "evaluator": { "params": [100], "type": "lt" },
            "query": { "params": ["A", "5m", "now"] }
          }],
          "name": "GitHub Rate Limit Low"
        }
      },
      {
        "title": "LLM Token Usage",
        "targets": [{
          "expr": "rate(telegit_llm_tokens_total[1h])",
          "legendFormat": "{{model}}"
        }],
        "type": "graph"
      },
      {
        "title": "Active Operations",
        "targets": [{
          "expr": "telegit_active_operations",
          "legendFormat": "{{type}}"
        }],
        "type": "graph"
      },
      {
        "title": "Error Rate by Type",
        "targets": [{
          "expr": "rate(telegit_messages_processed_total{status=\"error\"}[5m])",
          "legendFormat": "{{error_type}}"
        }],
        "type": "graph"
      }
    ],
    "refresh": "10s",
    "time": { "from": "now-6h", "to": "now" }
  }
}
```

**Alerting Rules (Prometheus/Alertmanager):**
```yaml
# prometheus/alerts.yml
groups:
  - name: telegit
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(telegit_messages_processed_total{status="error"}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in TeleGit"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: GitHubRateLimitCritical
        expr: telegit_github_rate_limit_remaining < 100
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "GitHub API rate limit nearly exhausted"
          description: "Only {{ $value }} requests remaining"

      - alert: LLMCostSpike
        expr: rate(telegit_llm_tokens_total[1h]) > 100000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "LLM token usage spike detected"
          description: "Token usage: {{ $value }} tokens/hour"
```

## Performance Optimization

### Caching Strategy

```javascript
// src/cache/strategy.js
const cacheConfig = {
  conversationContext: {
    ttl: 3600, // 1 hour
    maxSize: 1000, // entries
    evictionPolicy: 'LRU' // Least Recently Used
  },

  githubIssues: {
    ttl: 300, // 5 minutes
    maxSize: 500
  },

  userPreferences: {
    ttl: 86400, // 24 hours
    maxSize: 10000
  },

  llmResponses: {
    ttl: 1800, // 30 minutes for similar queries
    maxSize: 100
  }
};

// Conversation context cache invalidation
export class ConversationContextCache {
  constructor() {
    this.cache = new Map();
    this.config = cacheConfig.conversationContext;
  }

  // Calculate expiration based on thread activity
  calculateExpiry(threadId) {
    // Active threads: 1 hour
    // Inactive threads: 15 minutes
    const recentActivity = this.getLastActivity(threadId);
    const inactiveDuration = Date.now() - recentActivity;

    if (inactiveDuration > 15 * 60 * 1000) {
      return Date.now() + 15 * 60 * 1000;
    }
    return Date.now() + this.config.ttl * 1000;
  }

  // Store conversation context with expiration
  async set(threadId, messages) {
    const expiresAt = this.calculateExpiry(threadId);

    await supabase.from('conversation_context').upsert({
      thread_root_message_id: threadId,
      messages_chain: messages,
      cached_at: new Date(),
      expires_at: new Date(expiresAt)
    });

    this.cache.set(threadId, { messages, expiresAt });
    this.enforceMaxSize();
  }

  // Invalidation triggers
  async invalidate(threadId, reason) {
    switch (reason) {
      case 'message_edited':
      case 'message_deleted':
        // Remove from cache, will be rebuilt on next access
        this.cache.delete(threadId);
        await supabase
          .from('conversation_context')
          .delete()
          .eq('thread_root_message_id', threadId);
        break;

      case 'thread_limit_reached':
        // Keep only last N messages (prevent unbounded growth)
        const MAX_THREAD_DEPTH = 50;
        const cached = this.cache.get(threadId);
        if (cached?.messages.length > MAX_THREAD_DEPTH) {
          cached.messages = cached.messages.slice(-MAX_THREAD_DEPTH);
          await this.set(threadId, cached.messages);
        }
        break;
    }
  }

  // LRU eviction when maxSize exceeded
  enforceMaxSize() {
    if (this.cache.size > this.config.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }
}
```

### LLM Cost Controls

**Cost Estimation (GPT-4 Turbo pricing as baseline):**
- Input tokens: $0.01 per 1K tokens
- Output tokens: $0.03 per 1K tokens
- Average message processing: ~2K input tokens, ~500 output tokens
- Cost per message: ~$0.035

**Monthly Projections:**
| Messages/Day | Monthly Cost | Annual Cost |
|-------------|-------------|-------------|
| 100         | $105        | $1,260      |
| 500         | $525        | $6,300      |
| 1000        | $1,050      | $12,600     |

**Cost Control Implementation:**
```javascript
// src/monitoring/cost-tracking.js
export class LLMCostTracker {
  constructor() {
    this.limits = {
      perGroup: {
        daily: 1000,   // Max 1000 tokens/day per group
        monthly: 25000 // Max 25K tokens/month per group
      },
      global: {
        daily: 50000,   // Max 50K tokens/day globally
        monthly: 1000000 // Max 1M tokens/month globally
      }
    };
  }

  async checkBudget(groupId, estimatedTokens) {
    const usage = await this.getUsage(groupId);

    if (usage.daily + estimatedTokens > this.limits.perGroup.daily) {
      throw new Error('Daily token limit exceeded for this group');
    }

    if (usage.monthly + estimatedTokens > this.limits.perGroup.monthly) {
      throw new Error('Monthly token limit exceeded for this group');
    }

    // Check global limits
    const globalUsage = await this.getGlobalUsage();
    if (globalUsage.daily + estimatedTokens > this.limits.global.daily) {
      throw new Error('Global daily token limit exceeded');
    }

    return true;
  }

  async recordUsage(groupId, tokens) {
    await supabase.from('llm_usage').insert({
      group_id: groupId,
      tokens_used: tokens,
      timestamp: new Date()
    });

    // Update metrics
    metrics.llmTokensUsed.inc({
      model: 'gpt-4-turbo',
      operation: 'message_processing'
    }, tokens);
  }
}
```

**Budget Alerts:**
- 80% of monthly limit: Warning to group manager
- 90% of monthly limit: Critical alert to group manager
- 100% of monthly limit: Processing paused until next billing cycle

**Cost Optimization Strategies:**
1. Use cheaper models for simple classifications (GPT-3.5 Turbo)
2. Cache similar queries to avoid redundant LLM calls
3. Implement prompt optimization to reduce token usage
4. Use structured outputs to minimize response tokens
5. Consider self-hosted models for high-volume deployments

### Optimization Techniques

1. **Message Batching**: Group multiple operations for bulk processing
2. **Lazy Loading**: Load conversation context only when needed
3. **Connection Pooling**: Reuse database and HTTP connections
4. **Response Streaming**: Stream LLM responses for faster feedback
5. **Predictive Caching**: Pre-cache likely GitHub searches
6. **Thread Depth Limiting**: Max 50 messages to prevent unbounded context gathering

## Error Handling

### Error Recovery Flow

```mermaid
flowchart TD
    Error[Error Occurs] --> Type{Error Type?}
    
    Type -->|Rate Limit| Wait[Exponential Backoff]
    Wait --> Retry[Retry Operation]
    
    Type -->|Network| Check[Check Connection]
    Check --> Reconnect[Reconnect Service]
    Reconnect --> Retry
    
    Type -->|LLM| Fallback[Try Fallback Model]
    Fallback --> Success{Success?}
    Success -->|Yes| Continue[Continue Processing]
    Success -->|No| Manual[Flag for Manual Review]
    
    Type -->|GitHub| Validate[Validate Credentials]
    Validate --> Fix{Can Auto-Fix?}
    Fix -->|Yes| Retry
    Fix -->|No| Notify[Notify Manager]
    
    Type -->|Unknown| Log[Log Detailed Error]
    Log --> Alert[Send Alert]
    Alert --> Manual
    
    Retry --> Success2{Success?}
    Success2 -->|Yes| Continue
    Success2 -->|No| Manual
```

### Error Messages

```javascript
const errorMessages = {
  RATE_LIMIT: "⏳ Taking a breather - too many requests. Will retry shortly.",
  GITHUB_AUTH: "🔐 GitHub authentication issue. Please check your PAT with /configure",
  LLM_TIMEOUT: "🤔 AI is thinking too hard. Let me try again...",
  INTENT_UNCLEAR: "😕 I didn't quite understand that. Could you rephrase?",
  NETWORK_ERROR: "📡 Connection issues. Retrying...",
  INVALID_REPO: "❌ Can't access the GitHub repository. Please check configuration.",
  PERMISSION_DENIED: "🚫 You don't have permission for this operation."
};
```

## Extensibility Design

### Plugin Architecture

```javascript
// src/plugins/base.js
export class IntegrationPlugin {
  constructor(config) {
    this.name = this.constructor.name;
    this.config = config;
  }
  
  // Required methods
  async initialize() { throw new Error('Not implemented'); }
  async createItem(data) { throw new Error('Not implemented'); }
  async updateItem(id, data) { throw new Error('Not implemented'); }
  async searchItems(query) { throw new Error('Not implemented'); }
  async deleteItem(id) { throw new Error('Not implemented'); }
  
  // Lifecycle hooks
  async beforeCreate(data) { return data; }
  async afterCreate(result) { return result; }
  async onError(error) { throw error; }
}

// Example: Future Jira plugin
export class JiraPlugin extends IntegrationPlugin {
  async initialize() {
    this.client = new JiraClient(this.config);
    await this.client.authenticate();
  }
  
  async createItem(data) {
    const issue = await this.beforeCreate(data);
    const result = await this.client.createIssue({
      project: this.config.project,
      summary: issue.title,
      description: issue.body,
      issueType: this.mapIntentToIssueType(issue.intent)
    });
    return this.afterCreate(result);
  }
}
```

## Conclusion

TeleGit represents a production-ready architecture for AI-powered chat-to-task-management integration. The system leverages mature technologies (LangChain.js, Bottleneck, Supabase) while maintaining extensibility for future enhancements. The modular design, comprehensive testing strategy, and robust error handling ensure reliable operation at scale.

### Key Success Factors
1. **Non-disruptive UX** through emoji reactions and auto-deleting messages
2. **Optimistic execution** with post-action correction capabilities
3. **Extensible architecture** ready for additional integrations
4. **Production-grade infrastructure** with monitoring and observability
5. **Comprehensive testing** including LLM evaluation framework

### Next Steps
1. Implement core components following the architecture
2. Set up CI/CD pipeline with automated testing
3. Deploy MVP to staging environment
4. Conduct user acceptance testing
5. Progressive rollout to production groups
6. Monitor metrics and iterate based on feedback
