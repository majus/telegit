/**
 * Database schema types
 */

/**
 * Group configuration with encrypted GitHub credentials
 */
export interface GroupConfig {
  telegramGroupId: number;
  githubRepo: string;
  githubToken: string; // Decrypted token (encrypted in DB)
  managerUserId: number;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Database row for group_configs table
 */
export interface GroupConfigRow {
  telegram_group_id: number;
  github_repo: string;
  encrypted_github_token: string;
  manager_user_id: number;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Operation tracking
 */
export interface Operation {
  id: string; // UUID
  telegramGroupId: number;
  telegramMessageId: number;
  operationType: 'create_bug' | 'create_task' | 'create_idea' | 'update_issue' | 'search_issues';
  githubIssueUrl: string | null;
  operationData: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'undone';
  createdAt: Date;
}

/**
 * Database row for operations table
 */
export interface OperationRow {
  id: string;
  telegram_group_id: number;
  telegram_message_id: number;
  operation_type: string;
  github_issue_url: string | null;
  operation_data: Record<string, any>;
  status: string;
  created_at: Date;
}

/**
 * Operation feedback tracking
 */
export interface OperationFeedback {
  id: string; // UUID
  operationId: string;
  feedbackMessageId: number;
  scheduledDeletion: Date;
  dismissed: boolean;
  createdAt: Date;
}

/**
 * Database row for operation_feedback table
 */
export interface OperationFeedbackRow {
  id: string;
  operation_id: string;
  feedback_message_id: number;
  scheduled_deletion: Date;
  dismissed: boolean;
  created_at: Date;
}

/**
 * Conversation context caching
 */
export interface ConversationContext {
  id: string; // UUID
  telegramGroupId: number;
  threadRootMessageId: number;
  messagesChain: any[];
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Database row for conversation_context table
 */
export interface ConversationContextRow {
  id: string;
  telegram_group_id: number;
  thread_root_message_id: number;
  messages_chain: any[];
  cached_at: Date;
  expires_at: Date;
}

// Database query result types
export type QueryResult<T> = T[];

export interface InsertResult {
  rowCount: number;
  rows: any[];
}

export interface UpdateResult {
  rowCount: number;
  rows: any[];
}

export interface DeleteResult {
  rowCount: number;
}
