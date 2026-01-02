# message-filtering Deltas

## ADDED Requirements

### Requirement: Command Bypass
Slash commands SHALL bypass trigger detection and be handled before the message filtering middleware.

#### Scenario: Command in group chat
- **WHEN** a message is a slash command (e.g., `/start`, `/status`, `/unlink`)
- **THEN** the command SHALL be processed by Telegraf's command handler
- **AND** SHALL NOT go through trigger detection filtering
- **AND** the message SHALL NOT reach the generic message handler

#### Scenario: Non-command message
- **WHEN** a message is NOT a slash command
- **THEN** the message SHALL proceed through normal trigger detection
- **AND** SHALL be filtered by the message filtering middleware
