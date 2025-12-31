# Implementation Tasks

## 1. Dependencies & Configuration
- [x] 1.1 Update package.json: Remove `pg`, add `mongodb@^6.10.0` and `mongodb-memory-server@^10.1.1` (dev)
- [x] 1.2 Update config/env.js: Replace POSTGRES_* env vars with MONGODB_URI and MONGODB_DATABASE
- [x] 1.3 Update config/env.js: Modify databaseConfig object structure for MongoDB

## 2. Database Client Layer
- [x] 2.1 Rewrite src/database/db.js: Replace PostgreSQL Pool with MongoClient
- [x] 2.2 Implement getClient() and getDb() functions
- [x] 2.3 Implement testConnection() using db.command({ ping: 1 })
- [x] 2.4 Implement closePool() for graceful shutdown
- [x] 2.5 Implement query() wrapper for MongoDB operations
- [x] 2.6 Export ObjectId for repository use
- [x] 2.7 Maintain slow query logging (>100ms) and connection stats

## 3. Schema Initialization
- [x] 3.1 Create db/mongodb-schema.js with collection creation logic
- [x] 3.2 Define group_configs collection with validators and indexes
- [x] 3.3 Define operations collection with validators and indexes
- [x] 3.4 Define operation_feedback collection with validators and indexes (include telegram_chat_id field)
- [x] 3.5 Define conversation_context collection with validators and TTL index
- [x] 3.6 Export initializeSchema() function

## 4. Repository Refactoring
- [x] 4.1 Refactor src/database/repositories/config.js to use MongoDB operations
- [x] 4.2 Refactor src/database/repositories/operations.js to use MongoDB operations
- [x] 4.3 Refactor src/database/repositories/feedback.js to use MongoDB operations (fix telegram_chat_id bug)
- [x] 4.4 Refactor src/database/repositories/context.js to use MongoDB operations
- [x] 4.5 Update all repositories to transform ObjectId to string in responses
- [x] 4.6 Replace ON CONFLICT upsert patterns with findOneAndUpdate({ upsert: true })
- [x] 4.7 Replace JSONB merge operations with native object handling
- [x] 4.8 Update getCacheStats() to use MongoDB aggregation pipeline

## 5. Integration Updates
- [x] 5.1 Update src/api/health.js: Change SELECT 1 to db.command({ ping: 1 })
- [x] 5.2 Update src/index.js: Change health check dependency injection

## 6. Testing
- [x] 6.1 Create test/helpers/mongodb-test-helper.js with MongoMemoryServer setup
- [x] 6.2 Update test/unit/database/repositories.test.js: Replace PostgreSQL setup with MongoDB
- [x] 6.3 Update test cleanup queries to use MongoDB deleteMany()
- [x] 6.4 Update test assertions to expect ObjectId format (24-char hex)
- [ ] 6.5 Run full test suite and fix any failures

## 7. Deployment Configuration
- [x] 7.1 Update docker-compose.yml: Replace postgres service with mongodb
- [x] 7.2 Update docker-compose.yml: Update app environment variables (POSTGRES_* → MONGODB_*)
- [x] 7.3 Update docker-compose.yml: Update volume configuration for MongoDB
- [x] 7.4 Update dokploy.yaml: Replace postgres database with mongodb
- [x] 7.5 Update dokploy.yaml: Update environment variables and secrets
- [x] 7.6 Update dokploy.yaml: Update pre-deployment hook (migrate.js → mongodb-schema.js)
- [x] 7.7 Update DEPLOYMENT.md: Replace all PostgreSQL references with MongoDB
- [x] 7.8 Update DEPLOYMENT.md: Update environment variable documentation
- [x] 7.9 Update DEPLOYMENT.md: Update database setup instructions

## 8. Cleanup
- [x] 8.1 Delete db/schema.sql
- [x] 8.2 Delete db/init.sql
- [x] 8.3 Delete db/migrate.js
- [x] 8.4 Delete db/migrations/001_initial_schema.sql
- [x] 8.5 Update README.md: Replace PostgreSQL setup instructions with MongoDB
- [x] 8.6 Update CLAUDE.md: Update technical stack section

## 9. Deployment Preparation
- [x] 9.1 Document MongoDB connection string format in README
- [x] 9.2 Create .env.example with MONGODB_URI and MONGODB_DATABASE
- [ ] 9.3 Test schema initialization script: node db/mongodb-schema.js
- [ ] 9.4 Verify TTL index auto-expiration after 1 hour
- [ ] 9.5 Verify all indexes are created correctly
