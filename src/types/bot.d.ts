/**
 * Telegram Bot types
 */

import { Context as TelegrafContext } from 'telegraf';
import { Message, Update } from 'telegraf/types';

export interface BotContext extends TelegrafContext {
  // Custom context properties can be added here
  messageClassification?: MessageClassification;
  reactionStatus?: 'processing' | 'success' | 'error';
}

export interface MessageHandler {
  (ctx: BotContext): Promise<void>;
}

export interface ReactionEmoji {
  PROCESSING: string;
  SUCCESS: string;
  ERROR: string;
  DUPLICATE: string;
  IGNORED: string;
}

export interface BotCommandHandler {
  command: string;
  description: string;
  handler: (ctx: BotContext) => Promise<void>;
}

export interface MessageClassification {
  type: 'issue' | 'bug' | 'idea' | 'question' | 'ignore';
  confidence: number;
  reasoning?: string;
  suggestedLabels?: string[];
  suggestedTitle?: string;
}

export interface IssueCreationResult {
  success: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

export interface TemporaryMessage {
  chatId: number;
  messageId: number;
  expiresAt: Date;
}
