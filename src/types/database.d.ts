/**
 * Database schema types
 */

export interface TelegramMessage {
  id: string; // UUID
  telegram_message_id: number;
  chat_id: number;
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  message_text: string;
  message_date: Date;
  reply_to_message_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface GitHubIssue {
  id: string; // UUID
  telegram_message_id: string; // FK to telegram_messages.id
  github_issue_number: number;
  github_issue_url: string;
  issue_title: string;
  issue_body: string;
  issue_state: 'open' | 'closed';
  labels?: string[]; // JSON array
  created_at: Date;
  updated_at: Date;
  synced_at: Date;
}

export interface BotState {
  id: string; // UUID
  chat_id: number;
  state_key: string;
  state_value: Record<string, any>; // JSON object
  created_at: Date;
  updated_at: Date;
  expires_at?: Date;
}

export interface MessageClassification {
  id: string; // UUID
  telegram_message_id: string; // FK to telegram_messages.id
  classification: 'issue' | 'bug' | 'idea' | 'question' | 'ignore';
  confidence: number; // 0.0 to 1.0
  reasoning?: string;
  labels?: string[]; // Suggested labels
  created_at: Date;
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
