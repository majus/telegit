# private-message-handling Specification

## Purpose
TBD - created by archiving change refactor-message-filters-with-user-whitelist. Update Purpose after archive.
## Requirements
### Requirement: Private Message Routing

The system SHALL route private messages to appropriate handlers based on user whitelist status and active session state.

#### Scenario: Whitelisted user with active session

- **WHEN** a private message is received from a whitelisted user
- **AND** the user has an active setup session
- **THEN** the message SHALL be routed to `handleSetupMessage()`
- **AND** SHALL process the setup workflow (repository or PAT input)

#### Scenario: Whitelisted user without session

- **WHEN** a private message is received from a whitelisted user
- **AND** the user does NOT have an active setup session
- **THEN** the message SHALL be routed to `handleSetupMessage()`
- **AND** SHALL send guidance message explaining how to start setup

#### Scenario: Non-whitelisted user

- **WHEN** a private message is received from a non-whitelisted user
- **THEN** the system SHALL send "not authorized" error message
- **AND** the message SHALL NOT be processed further
- **AND** the interaction SHALL be logged for security monitoring

### Requirement: Session State Check

The system SHALL check for active setup sessions before routing private messages.

#### Scenario: Session exists and valid

- **WHEN** checking for a user's setup session
- **AND** a session exists for the user
- **AND** the session has not expired (less than 30 minutes old)
- **THEN** `hasActiveSession()` SHALL return `true`

#### Scenario: No session exists

- **WHEN** checking for a user's setup session
- **AND** no session exists for the user
- **THEN** `hasActiveSession()` SHALL return `false`

#### Scenario: Session expired

- **WHEN** checking for a user's setup session
- **AND** a session exists but is older than 30 minutes
- **THEN** the session SHALL be removed
- **AND** `hasActiveSession()` SHALL return `false`

### Requirement: Error Message Display

The system SHALL provide clear error messages for unauthorized access attempts.

#### Scenario: Unauthorized user message

- **WHEN** a non-whitelisted user sends a private message
- **THEN** the system SHALL reply with "❌ You are not authorized to use this bot. Please contact your administrator."
- **AND** SHALL NOT reveal any information about whitelisted users
- **AND** SHALL log the attempt with user ID

### Requirement: GitHub Setup Workflow Integration

The system SHALL integrate with existing GitHub authentication setup workflow.

#### Scenario: Setup handler invoked

- **WHEN** a whitelisted user's private message is processed
- **THEN** the system SHALL call `handleSetupMessage()` from auth-setup.js
- **AND** SHALL pass the PAT validator function
- **AND** SHALL maintain existing setup session state

#### Scenario: Repository URL input

- **WHEN** a user in AWAITING_REPO state sends a message
- **THEN** the existing `handleRepoInput()` flow SHALL be executed
- **AND** SHALL validate GitHub repository URL format

#### Scenario: PAT input

- **WHEN** a user in AWAITING_PAT state sends a message
- **THEN** the existing `handlePATInput()` flow SHALL be executed
- **AND** SHALL validate PAT format
- **AND** SHALL delete the message containing the PAT for security

### Requirement: Handler Factory

The system SHALL provide a factory function for creating private message handlers.

#### Scenario: Handler created with options

- **WHEN** `createPrivateMessageHandler()` is called with filter options
- **THEN** a Telegraf-compatible handler function SHALL be returned
- **AND** the handler SHALL use the provided allowedUserIds for whitelist checks

