# Design: PostgreSQL to MongoDB Migration

## Context

TeleGit currently uses PostgreSQL (via `pg` library) with 4 tables: group_configs, operations, operation_feedback, and conversation_context. The schema heavily uses JSONB columns for flexible data storage (settings, operation metadata, message chains). A critical schema bug exists where `operation_feedback` table code references a `telegram_chat_id` column that doesn't exist in the schema.

This is a fresh-start migration with no existing production data to preserve.

**Constraints:**
- Must maintain all existing functionality
- Must preserve AES-256-GCM encryption for GitHub PATs
- Must support JavaScript ES modules (not TypeScript for implementation)
- Must follow project conventions (Vitest, minimal dependencies)

**Stakeholders:**
- Development team (simpler JSON handling with MongoDB)
- Operations team (needs clear migration path and monitoring)

## Goals / Non-Goals

**Goals:**
- Replace PostgreSQL with MongoDB while maintaining feature parity
- Fix schema bug: Add telegram_chat_id field to operation_feedback
- Convert UUIDs to MongoDB's native ObjectIds
- Improve developer experience with native JSON/object handling
- Implement TTL indexes for automatic data expiration
- Maintain connection pooling and performance characteristics

**Non-Goals:**
- Data migration from PostgreSQL (fresh start only)
- Backward compatibility with existing database
- Support for dual database operation
- Schema versioning/migration system for MongoDB

## Decisions

### Decision: Use Official MongoDB Driver
**Rationale:** Official `mongodb` NPM package (v6.10.0) provides full feature support, active maintenance, and native ObjectId handling. Alternatives like Mongoose add unnecessary abstraction and complexity.

**Alternatives considered:**
- Mongoose: Adds schema layer, but project already has validation; unnecessary overhead
- Monk: Outdated, limited features
- Native driver chosen for simplicity and control

### Decision: Convert UUIDs to ObjectIds
**Rationale:** MongoDB's ObjectId provides built-in timestamp, uniqueness, and better indexing performance. UUIDs are PostgreSQL-specific and don't leverage MongoDB features.

**Alternatives considered:**
- Keep UUIDs as strings: Simpler migration but loses MongoDB benefits
- Hybrid approach: Complex to manage
- ObjectId chosen for native MongoDB optimization

### Decision: Use Schema Validators Instead of Triggers
**Rationale:** MongoDB schema validators provide runtime type checking. PostgreSQL triggers for auto-updating timestamps will be replaced with application-level logic in repositories.

**Trade-off:** Application must handle timestamp updates, but eliminates database-specific features and improves portability.

### Decision: TTL Index for Conversation Context
**Rationale:** MongoDB's native TTL index (`expireAfterSeconds`) automatically deletes expired documents, eliminating need for background cleanup jobs.

**Benefit:** Reduces code complexity, improves reliability, and leverages database feature.

### Decision: Upsert with findOneAndUpdate
**Rationale:** MongoDB's `findOneAndUpdate(..., { upsert: true })` directly replaces PostgreSQL's `ON CONFLICT DO UPDATE` pattern with atomic operation.

**Pattern:**
```javascript
await collection.findOneAndUpdate(
  { telegramGroupId: id },
  { $set: {...}, $setOnInsert: {...} },
  { upsert: true, returnDocument: 'after' }
)
```

### Decision: Aggregation Pipeline for Stats
**Rationale:** PostgreSQL's FILTER clause in ConversationContextRepository.getCacheStats() will be replaced with MongoDB's aggregation pipeline using `$cond` operator.

**Example:**
```javascript
{
  $group: {
    _id: null,
    total: { $sum: 1 },
    valid: { $sum: { $cond: [{ $gt: ['$expiresAt', new Date()] }, 1, 0] } }
  }
}
```

## Risks / Trade-offs

### Risk: Breaking API Changes
**Impact:** Entity IDs change from UUID format to ObjectId (24-char hex)
**Mitigation:**
- Document ID format change in README
- This is a fresh start, no external API contracts yet
- Internal code already abstracts IDs as strings

### Risk: Foreign Key Enforcement Loss
**Impact:** No automatic CASCADE DELETE like PostgreSQL
**Mitigation:**
- Implement application-level cascade logic in repositories
- Current code already handles manual cascade in deleteGroupConfig
- Add integration tests to verify cascade behavior

### Risk: Transaction Support
**Impact:** MongoDB transactions available but require replica sets
**Mitigation:**
- Current code doesn't use transactions (getClient() unused)
- Single-document operations are atomic by default
- If multi-document transactions needed later, configure replica set

### Risk: Schema Bug Fix Side Effects
**Impact:** Adding telegram_chat_id might reveal other missing validations
**Mitigation:**
- Review all FeedbackRepository methods for consistency
- Add comprehensive test coverage
- Validate schema with real Telegram data during testing

### Risk: TTL Index Lag
**Impact:** MongoDB TTL indexes run every 60 seconds, not immediately
**Mitigation:**
- Keep manual invalidateExpiredContexts() method for immediate cleanup
- Document TTL behavior in README
- Add monitoring for context cleanup metrics

## Migration Plan

### Phase 1: Foundation (Dependencies & Schema)
1. Update package.json dependencies
2. Update environment variable configuration
3. Rewrite database client (src/database/db.js)
4. Create schema initialization script (db/mongodb-schema.js)
5. Test connection and schema creation

### Phase 2: Repository Migration
6. Refactor ConfigRepository (encryption unchanged)
7. Refactor OperationsRepository
8. Refactor FeedbackRepository (fix schema bug)
9. Refactor ConversationContextRepository
10. Test each repository independently

### Phase 3: Integration & Testing
11. Update health check integration
12. Update test suite with mongodb-memory-server
13. Run full test suite
14. Manual integration testing with Telegram bot

### Phase 4: Deployment Configuration
15. Update docker-compose.yml (replace postgres service with mongodb)
16. Update dokploy.yaml (replace postgres database with mongodb)
17. Update DEPLOYMENT.md (MongoDB setup and troubleshooting)
18. Test Docker Compose locally
19. Validate Dokploy configuration

### Phase 5: Cleanup & Documentation
20. Delete PostgreSQL artifacts
21. Update README and CLAUDE.md
22. Verify deployment readiness

### Rollback Strategy
Since this is a fresh start:
- Keep PostgreSQL code in git history
- Can revert entire change if MongoDB proves problematic
- No data loss risk (no production data)

## Open Questions

None - all requirements clarified during planning phase.

## Monitoring & Observability

**Key Metrics to Monitor:**
- MongoDB connection pool utilization (totalCount, idleCount)
- Query performance (slow query logging >100ms maintained)
- TTL index effectiveness (expired documents cleaned up)
- Collection sizes and index usage

**Health Checks:**
- Ping command for database availability
- Connection pool health
- Index existence validation on startup

## Performance Considerations

**Expected Improvements:**
- Native JSON handling (no serialization overhead)
- Better indexing for partial queries (partial indexes on dismissed=false)
- Automatic TTL expiration reduces background job overhead

**Potential Concerns:**
- ObjectId slightly larger than bigint (12 bytes vs 8 bytes)
- No JOIN optimization (but current schema doesn't use joins)
- Aggregation pipeline for stats might be slower than SQL (monitor in production)

**Benchmark Plan:**
- Test operation creation throughput (1000 ops/sec target)
- Test feedback query performance with partial indexes
- Test context cleanup with TTL vs manual deletion

## Deployment Configuration Changes

### Docker Compose (docker-compose.yml)

**Current PostgreSQL service:**
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: telegit
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
```

**New MongoDB service:**
```yaml
mongodb:
  image: mongo:8-alpine
  container_name: telegit-mongodb
  restart: unless-stopped
  environment:
    MONGO_INITDB_DATABASE: telegit
  ports:
    - "27017:27017"
  volumes:
    - mongodb_data:/data/db
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 5
```

**App service environment variable changes:**
```yaml
# Remove:
POSTGRES_HOST: postgres
POSTGRES_PORT: 5432
POSTGRES_DB: telegit
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres

# Add:
MONGODB_URI: mongodb://mongodb:27017/telegit
MONGODB_DATABASE: telegit
```

**Volume changes:**
```yaml
volumes:
  mongodb_data:  # Replaces postgres_data
    driver: local
```

### Dokploy Configuration (dokploy.yaml)

**Database service changes:**
```yaml
# Current:
databases:
  - name: telegit-postgres
    type: postgres
    version: '16'
    config:
      database: ${POSTGRES_DB:-telegit}
      user: ${POSTGRES_USER:-postgres}
    volumes:
      - type: volume
        source: telegit-postgres-data
        target: /var/lib/postgresql/data

# New:
databases:
  - name: telegit-mongodb
    type: mongodb
    version: '8'
    config:
      database: ${MONGODB_DATABASE:-telegit}
    volumes:
      - type: volume
        source: telegit-mongodb-data
        target: /data/db
```

**Environment variable changes:**
```yaml
# Remove from application environment:
POSTGRES_HOST: ${POSTGRES_HOST}
POSTGRES_PORT: ${POSTGRES_PORT:-5432}
POSTGRES_DB: ${POSTGRES_DB}
POSTGRES_USER: ${POSTGRES_USER}

# Add to application environment:
MONGODB_URI: mongodb://telegit-mongodb:27017/${MONGODB_DATABASE:-telegit}
MONGODB_DATABASE: ${MONGODB_DATABASE:-telegit}
```

**Secrets changes:**
```yaml
# Remove from secrets list:
- POSTGRES_PASSWORD

# MongoDB doesn't require password in default setup
# If authentication needed, add:
# - MONGODB_USERNAME
# - MONGODB_PASSWORD
```

**Pre-deployment hook changes:**
```yaml
# Current:
hooks:
  pre_deploy:
    - name: Run database migrations
      command: node db/migrate.js
      timeout: 60s

# New:
hooks:
  pre_deploy:
    - name: Initialize MongoDB schema
      command: node db/mongodb-schema.js
      timeout: 60s
```

**Volume name changes:**
```yaml
volumes:
  - name: telegit-mongodb-data  # Replaces telegit-postgres-data
    driver: local
```

### DEPLOYMENT.md Updates

**Sections to update:**

1. **Prerequisites** (lines 20-34):
   - Replace PostgreSQL 16.x with MongoDB 8.x

2. **Local Development Setup** (lines 91-108):
   - Replace PostgreSQL Docker run command with MongoDB
   - Update database setup to use `node db/mongodb-schema.js`
   - Remove `psql` commands

3. **Environment Configuration** (lines 69-89, 198-230):
   - Replace POSTGRES_* variables with MONGODB_*
   - Update examples and table

4. **Docker Deployment** (lines 154-178):
   - Update MongoDB Docker run commands
   - Update connection examples

5. **Troubleshooting** (lines 328-408):
   - Replace PostgreSQL troubleshooting with MongoDB
   - Update connection test commands
   - Add MongoDB-specific error solutions

**Key command replacements:**

```bash
# Old (PostgreSQL):
psql -h localhost -U postgres -d telegit -f db/schema.sql
psql -h localhost -U postgres -d telegit

# New (MongoDB):
node db/mongodb-schema.js
mongosh mongodb://localhost:27017/telegit
```
