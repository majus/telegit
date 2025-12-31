/**
 * MongoDB Schema Initialization
 * Creates collections with validators and indexes
 */

import { getDb } from '../src/database/db.js';
import logger from '../src/utils/logger.js';

/**
 * Initialize MongoDB schema with collections, validators, and indexes
 * @returns {Promise<void>}
 */
export async function initializeSchema() {
  const db = await getDb();

  logger.info('Initializing MongoDB schema...');

  // Create group_configs collection
  await createGroupConfigsCollection(db);

  // Create operations collection
  await createOperationsCollection(db);

  // Create operation_feedback collection
  await createOperationFeedbackCollection(db);

  // Create conversation_context collection
  await createConversationContextCollection(db);

  logger.info('MongoDB schema initialization completed');
}

/**
 * Create group_configs collection with validators and indexes
 */
async function createGroupConfigsCollection(db) {
  try {
    await db.createCollection('group_configs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['telegramGroupId', 'githubRepo', 'encryptedGithubToken', 'managerUserId', 'createdAt', 'updatedAt'],
          properties: {
            telegramGroupId: {
              bsonType: 'long',
              description: 'Telegram group ID (negative number for groups)',
            },
            githubRepo: {
              bsonType: 'string',
              description: 'GitHub repository in format owner/repo',
            },
            encryptedGithubToken: {
              bsonType: 'string',
              description: 'AES-256-GCM encrypted GitHub PAT',
            },
            managerUserId: {
              bsonType: 'long',
              description: 'Telegram user ID of the group manager',
            },
            settings: {
              bsonType: 'object',
              description: 'Group-specific settings',
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp',
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp',
            },
          },
        },
      },
    });

    // Create indexes
    await db.collection('group_configs').createIndex({ telegramGroupId: 1 }, { unique: true });
    await db.collection('group_configs').createIndex({ managerUserId: 1 });

    logger.info('Created group_configs collection');
  } catch (error) {
    if (error.code === 48) {
      logger.info('group_configs collection already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Create operations collection with validators and indexes
 */
async function createOperationsCollection(db) {
  try {
    await db.createCollection('operations', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['telegramGroupId', 'telegramMessageId', 'operationType', 'status', 'createdAt', 'updatedAt'],
          properties: {
            telegramGroupId: {
              bsonType: 'long',
              description: 'Telegram group ID',
            },
            telegramMessageId: {
              bsonType: 'long',
              description: 'Telegram message ID',
            },
            operationType: {
              enum: ['create_bug', 'create_task', 'create_idea', 'update_issue', 'search_issues'],
              description: 'Type of GitHub operation',
            },
            status: {
              enum: ['pending', 'processing', 'completed', 'failed', 'undone'],
              description: 'Operation status',
            },
            operationData: {
              bsonType: 'object',
              description: 'Operation metadata (issue URL, error details, etc.)',
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp',
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp',
            },
          },
        },
      },
    });

    // Create indexes
    await db.collection('operations').createIndex({ telegramGroupId: 1 });
    await db.collection('operations').createIndex({ telegramMessageId: 1 });
    await db.collection('operations').createIndex({ status: 1 });
    await db.collection('operations').createIndex({ createdAt: -1 });

    logger.info('Created operations collection');
  } catch (error) {
    if (error.code === 48) {
      logger.info('operations collection already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Create operation_feedback collection with validators and indexes
 */
async function createOperationFeedbackCollection(db) {
  try {
    await db.createCollection('operation_feedback', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['operationId', 'telegramChatId', 'feedbackMessageId', 'scheduledDeletion', 'dismissed', 'createdAt'],
          properties: {
            operationId: {
              bsonType: 'objectId',
              description: 'Reference to operations collection',
            },
            telegramChatId: {
              bsonType: 'long',
              description: 'Telegram chat ID where feedback message was sent',
            },
            feedbackMessageId: {
              bsonType: 'long',
              description: 'Telegram message ID of the feedback message',
            },
            scheduledDeletion: {
              bsonType: 'date',
              description: 'Timestamp when message should be deleted',
            },
            dismissed: {
              bsonType: 'bool',
              description: 'Whether user dismissed the feedback message',
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp',
            },
          },
        },
      },
    });

    // Create indexes
    await db.collection('operation_feedback').createIndex({ operationId: 1 });
    await db.collection('operation_feedback').createIndex({ feedbackMessageId: 1 }, { unique: true });
    // Partial index for scheduled deletions (only non-dismissed messages)
    await db.collection('operation_feedback').createIndex(
      { scheduledDeletion: 1 },
      { partialFilterExpression: { dismissed: false } }
    );

    logger.info('Created operation_feedback collection');
  } catch (error) {
    if (error.code === 48) {
      logger.info('operation_feedback collection already exists');
    } else {
      throw error;
    }
  }
}

/**
 * Create conversation_context collection with validators and indexes
 */
async function createConversationContextCollection(db) {
  try {
    await db.createCollection('conversation_context', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['telegramGroupId', 'threadRootMessageId', 'messagesChain', 'expiresAt', 'createdAt', 'updatedAt'],
          properties: {
            telegramGroupId: {
              bsonType: 'long',
              description: 'Telegram group ID',
            },
            threadRootMessageId: {
              bsonType: 'long',
              description: 'Root message ID of the conversation thread',
            },
            messagesChain: {
              bsonType: 'array',
              description: 'Array of messages in the conversation thread',
              items: {
                bsonType: 'object',
              },
            },
            expiresAt: {
              bsonType: 'date',
              description: 'Expiration timestamp for TTL index',
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp',
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp',
            },
          },
        },
      },
    });

    // Create indexes
    await db.collection('conversation_context').createIndex(
      { telegramGroupId: 1, threadRootMessageId: 1 },
      { unique: true }
    );
    // TTL index for automatic expiration
    await db.collection('conversation_context').createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 }
    );

    logger.info('Created conversation_context collection');
  } catch (error) {
    if (error.code === 48) {
      logger.info('conversation_context collection already exists');
    } else {
      throw error;
    }
  }
}

// Run initialization if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await initializeSchema();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Schema initialization failed');
    process.exit(1);
  }
}
