-- TeleGit PostgreSQL Database Schema
-- Version: 1.0.0
-- Description: Database schema for TeleGit bot including group configs, operations, feedback, and conversation context

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: group_configs
-- Stores Telegram group configuration including encrypted GitHub credentials
CREATE TABLE IF NOT EXISTS group_configs (
    telegram_group_id BIGINT PRIMARY KEY,
    github_repo VARCHAR(255) NOT NULL,
    encrypted_github_token TEXT NOT NULL,
    manager_user_id BIGINT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_configs_manager_user ON group_configs(manager_user_id);

-- Table: operations
-- Tracks all operations performed by the bot
CREATE TABLE IF NOT EXISTS operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_group_id BIGINT NOT NULL,
    telegram_message_id BIGINT NOT NULL,
    operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('create_bug', 'create_task', 'create_idea', 'update_issue', 'search_issues')),
    github_issue_url VARCHAR(500),
    operation_data JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'undone')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_group_id) REFERENCES group_configs(telegram_group_id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_operations_group_id ON operations(telegram_group_id);
CREATE INDEX IF NOT EXISTS idx_operations_message_id ON operations(telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at DESC);

-- Table: operation_feedback
-- Tracks feedback messages for auto-deletion and reaction controls
CREATE TABLE IF NOT EXISTS operation_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL,
    feedback_message_id BIGINT NOT NULL UNIQUE,
    scheduled_deletion TIMESTAMP WITH TIME ZONE NOT NULL,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_operation_id ON operation_feedback(operation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON operation_feedback(feedback_message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_scheduled_deletion ON operation_feedback(scheduled_deletion) WHERE dismissed = FALSE;

-- Table: conversation_context
-- Caches conversation threads for context gathering with TTL
CREATE TABLE IF NOT EXISTS conversation_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_group_id BIGINT NOT NULL,
    thread_root_message_id BIGINT NOT NULL,
    messages_chain JSONB NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(telegram_group_id, thread_root_message_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_context_group_thread ON conversation_context(telegram_group_id, thread_root_message_id);
CREATE INDEX IF NOT EXISTS idx_context_expires_at ON conversation_context(expires_at);

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on group_configs
CREATE TRIGGER update_group_configs_updated_at
    BEFORE UPDATE ON group_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE group_configs IS 'Stores Telegram group configuration and encrypted GitHub credentials';
COMMENT ON TABLE operations IS 'Tracks all bot operations including GitHub issue creation and updates';
COMMENT ON TABLE operation_feedback IS 'Manages feedback messages with auto-deletion scheduling';
COMMENT ON TABLE conversation_context IS 'Caches conversation threads for context gathering with TTL expiration';

COMMENT ON COLUMN group_configs.encrypted_github_token IS 'GitHub PAT encrypted with AES-256-GCM';
COMMENT ON COLUMN operations.operation_type IS 'Type of operation: create_bug, create_task, create_idea, update_issue, search_issues';
COMMENT ON COLUMN operations.status IS 'Operation status: pending, processing, completed, failed, undone';
COMMENT ON COLUMN operation_feedback.scheduled_deletion IS 'Timestamp when feedback message should be auto-deleted';
COMMENT ON COLUMN conversation_context.expires_at IS 'TTL expiration timestamp for cached context';
