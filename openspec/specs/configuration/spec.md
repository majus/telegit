# configuration Specification

## Purpose
TBD - created by archiving change refactor-message-filters-with-user-whitelist. Update Purpose after archive.
## Requirements
### Requirement: User Whitelist Environment Variable

The system SHALL support user-level access control via the `TELEGRAM_USER_IDS` environment variable.

#### Scenario: User IDs configured

- **WHEN** `TELEGRAM_USER_IDS` is set to comma-separated user IDs (e.g., `"123456,789012"`)
- **THEN** the config SHALL parse them into an array of integers
- **AND** SHALL store them in `config.telegram.allowedUserIds`

#### Scenario: Empty user whitelist

- **WHEN** `TELEGRAM_USER_IDS` is an empty string or not set
- **THEN** the config SHALL set `allowedUserIds` to an empty array `[]`
- **AND** the system SHALL allow all users (no user-level filtering)

#### Scenario: Invalid user ID format

- **WHEN** `TELEGRAM_USER_IDS` contains non-numeric values
- **THEN** invalid values SHALL be filtered out
- **AND** valid numeric IDs SHALL still be parsed
- **AND** a warning SHALL be logged for invalid entries

#### Scenario: Whitespace handling

- **WHEN** `TELEGRAM_USER_IDS` contains whitespace (e.g., `"123456, 789012 , 111222"`)
- **THEN** whitespace SHALL be trimmed before parsing
- **AND** all valid IDs SHALL be correctly extracted

### Requirement: Configuration Structure

The system SHALL provide a structured configuration object with Telegram settings.

#### Scenario: Telegram config complete

- **WHEN** configuration is loaded
- **THEN** `config.telegram` SHALL contain:
  - `botToken` (string) - Telegram bot API token
  - `allowedChatIds` (number[]) - Whitelisted group chat IDs
  - `allowedUserIds` (number[]) - Whitelisted user IDs

#### Scenario: Optional fields default

- **WHEN** `TELEGRAM_USER_IDS` is not set
- **THEN** `allowedUserIds` SHALL default to empty array
- **AND** other required fields SHALL still be validated and loaded

### Requirement: Zod Schema Validation

The system SHALL validate environment variables using Zod schema.

#### Scenario: Schema includes user IDs

- **WHEN** the Zod schema is defined
- **THEN** it SHALL include `TELEGRAM_USER_IDS` as optional string field
- **AND** SHALL default to empty string if not provided

#### Scenario: Validation passes

- **WHEN** all required environment variables are valid
- **AND** optional `TELEGRAM_USER_IDS` is valid or absent
- **THEN** configuration loading SHALL succeed
- **AND** SHALL return parsed config object

### Requirement: Backward Compatibility

The system SHALL maintain backward compatibility for existing deployments.

#### Scenario: Existing deployment without user whitelist

- **WHEN** an existing deployment does not set `TELEGRAM_USER_IDS`
- **THEN** the system SHALL behave as before (allow all users)
- **AND** group message filtering SHALL only use chat whitelist
- **AND** private messages SHALL be allowed from any user with valid session

#### Scenario: Migration path

- **WHEN** a deployment wants to enable user whitelist
- **THEN** they SHALL set `TELEGRAM_USER_IDS` environment variable
- **AND** restart the bot
- **AND** user-level filtering SHALL activate immediately

### Requirement: Configuration Type Safety

The system SHALL provide TypeScript type definitions for configuration.

#### Scenario: Type definition includes user IDs

- **WHEN** TypeScript type definitions are checked
- **THEN** `ParsedConfig.telegram.allowedUserIds` SHALL be defined as `number[]`
- **AND** SHALL be non-optional (but may be empty array)

#### Scenario: Type checking enforced

- **WHEN** code accesses `config.telegram.allowedUserIds`
- **THEN** TypeScript SHALL enforce correct type usage
- **AND** SHALL prevent undefined access errors

