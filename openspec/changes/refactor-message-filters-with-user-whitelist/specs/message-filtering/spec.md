# Message Filtering

## ADDED Requirements

### Requirement: Trigger Detection

The system SHALL detect messages that trigger bot processing based on mentions or hashtags.

#### Scenario: Bot mentioned

- **WHEN** a message contains `@BotUsername` in text or entities
- **THEN** the message SHALL be marked as triggered

#### Scenario: Hashtag present

- **WHEN** a message contains one or more hashtags (e.g., `#bug`, `#task`, `#idea`)
- **THEN** the message SHALL be marked as triggered
- **AND** hashtags SHALL be extracted without `#` prefix and normalized to lowercase

#### Scenario: No trigger

- **WHEN** a message contains neither bot mention nor hashtags
- **THEN** the message SHALL NOT be marked as triggered
- **AND** SHALL NOT proceed to processing

### Requirement: Chat Whitelist Filtering

The system SHALL enforce chat-level access control for group messages.

#### Scenario: Whitelisted chat

- **WHEN** a message is from a chat in the `allowedChatIds` list
- **THEN** the message SHALL pass chat whitelist filtering

#### Scenario: Non-whitelisted chat

- **WHEN** a message is from a chat NOT in the `allowedChatIds` list
- **THEN** the message SHALL be filtered out
- **AND** SHALL NOT proceed to processing

#### Scenario: Empty chat whitelist

- **WHEN** `allowedChatIds` is an empty array
- **THEN** all chats SHALL be allowed

### Requirement: User Whitelist Filtering

The system SHALL enforce user-level access control for both group and private messages.

#### Scenario: Whitelisted user

- **WHEN** a message is from a user in the `allowedUserIds` list
- **THEN** the message SHALL pass user whitelist filtering

#### Scenario: Non-whitelisted user in group

- **WHEN** a message is from a user NOT in the `allowedUserIds` list
- **AND** the message is in a group chat
- **THEN** the message SHALL be filtered out
- **AND** SHALL NOT proceed to processing

#### Scenario: Empty user whitelist

- **WHEN** `allowedUserIds` is an empty array
- **THEN** all users SHALL be allowed

### Requirement: Group Message Complete Filtering

The system SHALL apply combined filtering logic for group messages.

#### Scenario: All filters pass

- **WHEN** a group message is triggered (mention or hashtag)
- **AND** the chat is in the allowed chat list
- **AND** the user is in the allowed user list (or user whitelist is empty)
- **THEN** the message SHALL be marked for processing
- **AND** `ctx.state.isGroupMessage` SHALL be set to `true`

#### Scenario: Missing trigger

- **WHEN** a group message has no mention or hashtags
- **THEN** the message SHALL NOT be marked for processing
- **AND** SHALL be silently ignored

#### Scenario: Chat whitelist blocks

- **WHEN** a group message is triggered
- **AND** the chat is NOT in the allowed chat list
- **THEN** the message SHALL NOT be marked for processing
- **AND** filter result reason SHALL indicate "Chat not in whitelist"

#### Scenario: User whitelist blocks

- **WHEN** a group message is triggered
- **AND** the chat is whitelisted
- **AND** the user is NOT in the allowed user list
- **THEN** the message SHALL NOT be marked for processing
- **AND** filter result reason SHALL indicate "User not in whitelist"

### Requirement: Private Message Filtering

The system SHALL route all private messages through the filter to enable appropriate responses.

#### Scenario: Private message passes through

- **WHEN** any private message is received
- **THEN** the middleware SHALL set `ctx.state.isPrivateMessage` to `true`
- **AND** SHALL call `next()` to route to private message handler

#### Scenario: Private message whitelisted with session

- **WHEN** a private message is from a whitelisted user
- **AND** the user has an active setup session
- **THEN** filter result `shouldProcess` SHALL be `true`
- **AND** `ctx.state.isPrivateMessageSetup` SHALL be set to `true`

#### Scenario: Private message whitelisted without session

- **WHEN** a private message is from a whitelisted user
- **AND** the user does NOT have an active setup session
- **THEN** filter result `shouldProcess` SHALL be `false`
- **AND** filter result SHALL indicate user is whitelisted but has no session

#### Scenario: Private message not whitelisted

- **WHEN** a private message is from a non-whitelisted user
- **THEN** filter result `shouldProcess` SHALL be `false`
- **AND** filter result `isWhitelisted` SHALL be `false`

### Requirement: Filter Middleware Factory

The system SHALL provide a middleware factory for Telegraf integration.

#### Scenario: Middleware created with options

- **WHEN** `createFilterMiddleware()` is called with filter options
- **THEN** a Telegraf middleware function SHALL be returned
- **AND** the middleware SHALL use the provided options for filtering

#### Scenario: Middleware filters group message

- **WHEN** the middleware processes a group message
- **AND** the message passes all filters
- **THEN** `ctx.state.filterResult` SHALL contain filter metadata
- **AND** `ctx.state.isGroupMessage` SHALL be `true`
- **AND** `next()` SHALL be called

#### Scenario: Middleware blocks group message

- **WHEN** the middleware processes a group message
- **AND** the message fails any filter
- **THEN** `next()` SHALL NOT be called
- **AND** the message SHALL be silently ignored

#### Scenario: Middleware routes private message

- **WHEN** the middleware processes a private message
- **THEN** `ctx.state.isPrivateMessage` SHALL be `true`
- **AND** `next()` SHALL always be called (routing to handler)

### Requirement: Configuration Decoupling

The system SHALL NOT directly access global configuration within filter functions.

#### Scenario: Explicit options required

- **WHEN** `filterMessage()` is called without options
- **THEN** filtering SHALL use the provided parameters
- **AND** SHALL NOT call `getConfig()` internally

#### Scenario: Testable filters

- **WHEN** filter functions are used in tests
- **THEN** they SHALL accept mock options without requiring global config
- **AND** SHALL produce deterministic results based on inputs
