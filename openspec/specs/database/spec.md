# database Specification

## Purpose
TBD - created by archiving change migrate-to-mongodb. Update Purpose after archive.
## Requirements
### Requirement: MongoDB Connection Management
The system SHALL use MongoDB as the primary database with connection pooling configured for max 20 connections, min 2 connections, connection timeout 2000ms, and socket timeout 30000ms.

#### Scenario: Successful database connection
- **WHEN** the application starts
- **THEN** a MongoDB client connects to the URI from MONGODB_URI environment variable
- **AND** a connection pool is established with the configured limits
- **AND** the database is selected from MONGODB_DATABASE environment variable

#### Scenario: Connection health check
- **WHEN** the health check endpoint is called
- **THEN** the system executes db.command({ ping: 1 })
- **AND** returns success if ping responds within timeout

#### Scenario: Graceful shutdown
- **WHEN** the application receives shutdown signal
- **THEN** all MongoDB connections are closed
- **AND** pending operations are allowed to complete before shutdown

### Requirement: Group Configuration Storage
The system SHALL store encrypted GitHub credentials and settings per Telegram group in a MongoDB collection with unique telegramGroupId indexing.

#### Scenario: Store group configuration
- **WHEN** a group administrator configures GitHub authentication
- **THEN** the system stores telegramGroupId, githubRepo, encryptedGithubToken, managerUserId, and settings
- **AND** the GitHub PAT is encrypted using AES-256-GCM before storage
- **AND** an ObjectId is generated as the document _id

#### Scenario: Retrieve group configuration
- **WHEN** retrieving configuration for a Telegram group
- **THEN** the system queries by telegramGroupId
- **AND** decrypts the GitHub PAT before returning
- **AND** transforms the _id ObjectId to a string

#### Scenario: Update group settings
- **WHEN** updating settings for an existing group
- **THEN** the system uses findOneAndUpdate with $set operator
- **AND** updates the updatedAt timestamp
- **AND** merges new settings with existing settings object

#### Scenario: Upsert group configuration
- **WHEN** setting configuration for a group that may or may not exist
- **THEN** the system uses findOneAndUpdate with upsert: true
- **AND** sets createdAt only on insert using $setOnInsert
- **AND** always updates updatedAt using $set

### Requirement: Operation Tracking
The system SHALL track all GitHub operations with metadata stored as native MongoDB objects and indexed for efficient queries.

#### Scenario: Create operation record
- **WHEN** a GitHub operation is initiated
- **THEN** the system inserts a document with telegramGroupId, telegramMessageId, operationType, status, and operationData
- **AND** generates an ObjectId for the document _id
- **AND** validates operationType against enum: create_bug, create_task, create_idea, update_issue, search_issues
- **AND** validates status against enum: pending, processing, completed, failed, undone

#### Scenario: Update operation status
- **WHEN** an operation completes or fails
- **THEN** the system updates the status field using findOneAndUpdate
- **AND** optionally merges metadata into operationData
- **AND** returns the updated document with returnDocument: 'after'

#### Scenario: Query operations by message ID
- **WHEN** searching for operations related to a Telegram message
- **THEN** the system queries by telegramMessageId
- **AND** sorts by createdAt DESC
- **AND** returns the most recent operation

#### Scenario: Get operation history for group
- **WHEN** retrieving recent operations for a group
- **THEN** the system queries by telegramGroupId
- **AND** sorts by createdAt DESC
- **AND** limits results to specified count (default 50)

### Requirement: Feedback Message Lifecycle
The system SHALL track feedback messages with scheduled deletion timestamps and telegram_chat_id for proper message management.

#### Scenario: Create feedback record
- **WHEN** the bot sends a feedback message
- **THEN** the system stores operationId (as ObjectId reference), telegramChatId, feedbackMessageId, and scheduledDeletion
- **AND** sets dismissed to false
- **AND** validates that telegramChatId and feedbackMessageId are numbers

#### Scenario: Query scheduled deletions
- **WHEN** the background scheduler runs
- **THEN** the system queries for dismissed: false AND scheduledDeletion <= current time
- **AND** uses the partial index on scheduledDeletion for efficiency
- **AND** sorts by scheduledDeletion ASC

#### Scenario: Mark feedback as dismissed
- **WHEN** a user reacts with 👍 to dismiss feedback
- **THEN** the system updates dismissed to true
- **AND** the document remains in the collection but is excluded from scheduled deletion queries

#### Scenario: Delete feedback record
- **WHEN** a feedback message is successfully deleted from Telegram
- **THEN** the system deletes the document by feedbackMessageId
- **AND** returns true if a document was deleted

### Requirement: Conversation Context Caching
The system SHALL cache conversation thread context with automatic TTL-based expiration using MongoDB's native TTL index feature.

#### Scenario: Cache thread context
- **WHEN** processing a reply message in a thread
- **THEN** the system stores telegramGroupId, threadRootMessageId, messagesChain (array), and expiresAt
- **AND** uses findOneAndUpdate with upsert: true for atomic cache update
- **AND** calculates expiresAt as current time + ttlMinutes
- **AND** enforces unique constraint on (telegramGroupId, threadRootMessageId)

#### Scenario: Retrieve valid cached context
- **WHEN** fetching context for a thread
- **THEN** the system queries by telegramGroupId and threadRootMessageId
- **AND** only returns documents where expiresAt > current time
- **AND** transforms the messagesChain array from native MongoDB storage

#### Scenario: Automatic TTL expiration
- **WHEN** a context document's expiresAt timestamp passes
- **THEN** MongoDB's TTL index automatically deletes the document
- **AND** no manual cleanup is required
- **AND** expiration occurs within 60 seconds of the expiresAt time

#### Scenario: Get cache statistics
- **WHEN** requesting cache statistics
- **THEN** the system uses an aggregation pipeline
- **AND** calculates total count, valid count (expiresAt > now), and expired count (expiresAt <= now)
- **AND** uses $cond operator for conditional counting in $group stage

### Requirement: Schema Validation
The system SHALL enforce schema validation rules at the MongoDB collection level for data integrity.

#### Scenario: Validate required fields
- **WHEN** inserting a document into any collection
- **THEN** MongoDB validates required fields using $jsonSchema validator
- **AND** rejects documents missing required fields
- **AND** returns validation error with field details

#### Scenario: Validate field types
- **WHEN** inserting or updating documents
- **THEN** MongoDB validates field types (e.g., telegramGroupId as long, settings as object)
- **AND** rejects documents with incorrect types
- **AND** ensures array fields contain arrays and object fields contain objects

#### Scenario: Validate enum values
- **WHEN** inserting operations with operationType or status
- **THEN** MongoDB validates against allowed enum values
- **AND** rejects documents with invalid enum values

### Requirement: Index Management
The system SHALL create and maintain indexes for efficient query performance on all collections.

#### Scenario: Unique indexes
- **WHEN** the schema is initialized
- **THEN** unique indexes are created on telegramGroupId (group_configs) and feedbackMessageId (operation_feedback)
- **AND** compound unique index on (telegramGroupId, threadRootMessageId) for conversation_context
- **AND** insertion of duplicate values is rejected with unique constraint error

#### Scenario: Query optimization indexes
- **WHEN** the schema is initialized
- **THEN** indexes are created on frequently queried fields
- **AND** operations collection has indexes on: telegramGroupId, telegramMessageId, status, createdAt (desc)
- **AND** group_configs has index on managerUserId
- **AND** operation_feedback has indexes on operationId and scheduledDeletion (partial)

#### Scenario: Partial index for scheduled deletions
- **WHEN** querying for scheduled deletions
- **THEN** the system uses a partial index on scheduledDeletion
- **AND** the index only includes documents where dismissed = false
- **AND** index size is reduced and query performance improved

#### Scenario: TTL index for auto-expiration
- **WHEN** the schema is initialized
- **THEN** a TTL index is created on conversation_context.expiresAt
- **AND** expireAfterSeconds is set to 0 (immediate expiration when expiresAt passes)
- **AND** MongoDB automatically removes expired documents every 60 seconds

### Requirement: Slow Query Monitoring
The system SHALL log queries that exceed 100ms duration for performance monitoring and optimization.

#### Scenario: Normal query performance
- **WHEN** a database operation completes in less than 100ms
- **THEN** the operation completes normally
- **AND** no warning is logged

#### Scenario: Slow query detection
- **WHEN** a database operation takes longer than 100ms
- **THEN** the system logs a warning with the duration
- **AND** continues normal operation without failing the request

### Requirement: Error Handling and Logging
The system SHALL handle database errors gracefully and log them with appropriate context for debugging.

#### Scenario: Connection error
- **WHEN** the MongoDB connection fails
- **THEN** the system logs the error with connection details
- **AND** returns false from testConnection()
- **AND** allows the application to handle the failure appropriately

#### Scenario: Query error
- **WHEN** a database operation fails (validation, unique constraint, network)
- **THEN** the system logs the error with operation context
- **AND** re-throws the error to the caller
- **AND** includes sufficient detail for debugging

#### Scenario: Repository operation error
- **WHEN** a repository method encounters an error
- **THEN** the error is logged with method name, parameters, and error details
- **AND** the error is propagated to the caller
- **AND** sensitive data (passwords, tokens) is excluded from logs

### Requirement: Docker Compose Configuration
The system SHALL provide Docker Compose configuration with MongoDB service replacing PostgreSQL for local development and testing.

#### Scenario: MongoDB service configuration
- **WHEN** docker-compose.yml is used to start services
- **THEN** a MongoDB service is defined using mongo:8-alpine image
- **AND** the service exposes port 27017
- **AND** MongoDB data is persisted in a named volume
- **AND** health checks verify MongoDB availability

#### Scenario: Application environment variables
- **WHEN** the app service starts via Docker Compose
- **THEN** MONGODB_URI environment variable is set to mongodb://mongodb:27017/telegit
- **AND** MONGODB_DATABASE environment variable is set to telegit
- **AND** POSTGRES_* environment variables are removed
- **AND** the app depends on MongoDB service health check

#### Scenario: Volume persistence
- **WHEN** containers are stopped and restarted
- **THEN** MongoDB data persists in the mongodb_data volume
- **AND** database state is preserved across restarts

### Requirement: Dokploy Deployment Configuration
The system SHALL provide Dokploy configuration with MongoDB database service for production deployments.

#### Scenario: MongoDB database service
- **WHEN** deploying via Dokploy
- **THEN** a MongoDB database service is configured with type: mongodb
- **AND** version 8 is specified
- **AND** resource limits are defined (CPU, memory)
- **AND** persistent storage is configured with named volume

#### Scenario: Application environment variables
- **WHEN** the application is deployed via Dokploy
- **THEN** MONGODB_URI secret references the MongoDB connection string
- **AND** MONGODB_DATABASE environment variable is configured
- **AND** POSTGRES_* variables are removed from environment and secrets

#### Scenario: Pre-deployment hook
- **WHEN** deploying new application version
- **THEN** the pre-deployment hook runs node db/mongodb-schema.js
- **AND** MongoDB schema is initialized with collections and indexes
- **AND** deployment fails if schema initialization fails

#### Scenario: Database backup configuration
- **WHEN** MongoDB service is configured in Dokploy
- **THEN** automatic backups are enabled
- **AND** backup schedule is set to daily at 2 AM
- **AND** backup retention is configured for 7 days

### Requirement: Deployment Documentation
The system SHALL provide comprehensive deployment documentation updated for MongoDB configuration and setup.

#### Scenario: Environment variable documentation
- **WHEN** reviewing DEPLOYMENT.md
- **THEN** all POSTGRES_* environment variables are replaced with MONGODB_* equivalents
- **AND** MONGODB_URI format is documented with examples
- **AND** MONGODB_DATABASE usage is explained
- **AND** migration guide from PostgreSQL to MongoDB is included

#### Scenario: Local development setup
- **WHEN** following local development instructions
- **THEN** MongoDB installation and setup instructions are provided
- **AND** Docker-based MongoDB setup is documented
- **AND** Schema initialization steps are clear (node db/mongodb-schema.js)
- **AND** Connection verification commands are provided

#### Scenario: Docker deployment instructions
- **WHEN** following Docker deployment guide
- **THEN** MongoDB Docker image usage is documented
- **AND** Volume mounting for data persistence is explained
- **AND** docker-compose.yml usage is updated for MongoDB
- **AND** Health check configuration is documented

#### Scenario: Troubleshooting guide
- **WHEN** encountering MongoDB connection issues
- **THEN** troubleshooting steps specific to MongoDB are provided
- **AND** Connection verification commands are documented
- **AND** Common MongoDB errors and solutions are listed
- **AND** PostgreSQL troubleshooting steps are replaced with MongoDB equivalents

