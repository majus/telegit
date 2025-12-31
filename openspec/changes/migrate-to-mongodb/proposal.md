# Change: Migrate from PostgreSQL to MongoDB

## Why

The project currently uses PostgreSQL directly (via `pg` library), but MongoDB provides better flexibility for the JSON-heavy data model used throughout TeleGit (operation metadata, conversation contexts, flexible settings). This migration also fixes a critical schema bug where the `operation_feedback` table is missing the `telegram_chat_id` column that the code references.

## What Changes

- **BREAKING**: Replace PostgreSQL with MongoDB as the primary database
- **BREAKING**: Convert all UUIDs to MongoDB ObjectIds (24-char hex strings)
- Replace `pg` NPM library with official `mongodb@^6.10.0` driver
- Rewrite database client (`src/database/db.js`) for MongoDB connection pooling
- Refactor all 4 repositories to use MongoDB operations instead of SQL queries
- Create MongoDB schema initialization script with collections and indexes
- Fix schema bug: Add `telegram_chat_id` field to `operation_feedback` collection
- Update environment variables from `POSTGRES_*` to `MONGODB_URI` and `MONGODB_DATABASE`
- Implement TTL index for automatic conversation context expiration
- Update tests to use in-memory MongoDB (`mongodb-memory-server`)
- Remove PostgreSQL-specific files (schema.sql, migrations, init scripts)

## Impact

**Affected specs:**
- `specs/database` (new capability being added)

**Affected code:**
- `config/env.js` - Environment variable configuration
- `src/database/db.js` - Complete rewrite for MongoDB client
- `src/database/repositories/config.js` - Repository refactoring
- `src/database/repositories/operations.js` - Repository refactoring
- `src/database/repositories/feedback.js` - Repository refactoring + schema bug fix
- `src/database/repositories/context.js` - Repository refactoring
- `src/api/health.js` - Health check adaptation
- `src/index.js` - Database dependency injection
- `test/unit/database/repositories.test.js` - Test updates
- `db/mongodb-schema.js` - New schema initialization script
- `test/helpers/mongodb-test-helper.js` - New test utilities
- `docker-compose.yml` - Replace PostgreSQL service with MongoDB
- `dokploy.yaml` - Replace PostgreSQL database config with MongoDB
- `DEPLOYMENT.md` - Update deployment documentation

**Files to delete:**
- `db/schema.sql`
- `db/init.sql`
- `db/migrate.js`
- `db/migrations/001_initial_schema.sql`

**Breaking changes:**
- Environment variable changes require deployment configuration updates
- All entity IDs change format from UUID to ObjectId (impacts API responses if exposed externally)
- Database connection string format changes
- No data migration path (fresh start only)
