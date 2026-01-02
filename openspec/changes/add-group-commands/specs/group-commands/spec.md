# Group Commands

## ADDED Requirements

### Requirement: Group-Only Command Validation
All commands SHALL only work in group chats (type 'group' or 'supergroup') and reject private messages.

#### Scenario: Command in group chat
- **WHEN** user sends a command in a group or supergroup
- **THEN** command handler processes the request

#### Scenario: Command in private chat
- **WHEN** user sends a command in a private chat
- **THEN** bot replies with "This command is only available in group chats" and exits

### Requirement: Start Command
The bot SHALL provide a `/start` command that displays introduction, capabilities, available commands, and GitHub link status.

#### Scenario: Start in linked group
- **WHEN** user sends `/start` in a whitelisted group that is linked to GitHub
- **THEN** bot displays intro message with:
  - Bot capabilities (mention/hashtag triggers, reaction controls)
  - Available commands list (`/start`, `/status`, `/unlink` with manager-only indicators)
  - Link status showing "✅ Linked to owner/repo"

#### Scenario: Start in unlinked group
- **WHEN** user sends `/start` in a whitelisted group that is NOT linked to GitHub
- **THEN** bot displays intro message with "❌ Not linked" status
- **AND** automatically triggers GitHub setup workflow via `sendAuthRequiredMessage()`

#### Scenario: Start in non-whitelisted group
- **WHEN** user sends `/start` in a group not in the chat whitelist
- **THEN** bot replies with whitelist error message and exits

### Requirement: Status Command
The bot SHALL provide a `/status` command that displays usage statistics and connection health (manager-only).

#### Scenario: Status as group manager
- **WHEN** group manager sends `/status` in a whitelisted linked group
- **THEN** bot displays status message with:
  - Group info (GitHub repository, manager username, created date)
  - Operations summary (total, completed, failed, pending with breakdown by type)
  - Conversation cache statistics (total, valid, expired)
  - Feedback queue count
  - Connection health for Database (✅/❌), LLM API (✅/❌), GitHub MCP (✅/❌)
  - System uptime in human-readable format

#### Scenario: Status as non-manager
- **WHEN** non-manager user sends `/status` in a whitelisted linked group
- **THEN** bot replies with "Only the group manager can view status" and exits

#### Scenario: Status in unlinked group
- **WHEN** user sends `/status` in a whitelisted group that is NOT linked
- **THEN** bot replies with "Group is not linked to any GitHub repository" and exits

#### Scenario: Status in non-whitelisted group
- **WHEN** user sends `/status` in a group not in the chat whitelist
- **THEN** bot replies with whitelist error message and exits

### Requirement: Unlink Command
The bot SHALL provide a `/unlink` command that disconnects the group from GitHub (manager-only, with confirmation).

#### Scenario: Unlink as group manager in whitelisted group
- **WHEN** group manager sends `/unlink` in a whitelisted linked group
- **THEN** bot displays confirmation message with inline keyboard
- **AND** message contains "Are you sure you want to unlink this group from GitHub?"
- **AND** inline keyboard has buttons [Yes] [No] with callback data `unlink:confirm:{chatId}` and `unlink:cancel:{chatId}`

#### Scenario: Unlink as group manager in delisted group
- **WHEN** group manager sends `/unlink` in a non-whitelisted linked group
- **THEN** bot displays confirmation message (bypasses whitelist check for opt-out)
- **AND** message contains inline keyboard as above

#### Scenario: Unlink as non-manager
- **WHEN** non-manager user sends `/unlink` in a linked group
- **THEN** bot replies with "Only the group manager can unlink this group" and exits

#### Scenario: Unlink in unlinked group
- **WHEN** user sends `/unlink` in a group that is NOT linked
- **THEN** bot replies with "Group is not linked to any GitHub repository" and exits

### Requirement: Unlink Confirmation Callback
The bot SHALL handle inline keyboard callbacks for unlink confirmation.

#### Scenario: User confirms unlink
- **WHEN** group manager clicks "Yes" button on unlink confirmation
- **THEN** bot verifies caller is still the group manager
- **AND** deletes group configuration via `ConfigRepository.deleteGroupConfig(chatId)`
- **AND** edits message to "✅ Group has been unlinked from GitHub repository"
- **AND** removes inline keyboard
- **AND** answers callback query to remove loading state

#### Scenario: User cancels unlink
- **WHEN** user clicks "No" button on unlink confirmation
- **THEN** bot edits message to "❌ Unlink cancelled"
- **AND** removes inline keyboard
- **AND** answers callback query

#### Scenario: Non-manager tries to confirm
- **WHEN** non-manager user clicks "Yes" button on unlink confirmation
- **THEN** bot verifies caller is NOT the group manager
- **AND** answers callback query with error message
- **AND** does NOT delete configuration

### Requirement: Whitelist Access Control for Commands
Commands SHALL respect whitelist access control based on command type.

#### Scenario: Start command checks whitelist
- **WHEN** user sends `/start` in a group
- **THEN** bot checks if group is in chat whitelist
- **AND** if user whitelist is set, also checks if user is whitelisted
- **AND** rejects if either check fails

#### Scenario: Status command checks whitelist
- **WHEN** user sends `/status` in a group
- **THEN** bot checks whitelist access the same way as `/start`

#### Scenario: Unlink command bypasses whitelist
- **WHEN** user sends `/unlink` in a group
- **THEN** bot does NOT check whitelist to allow delisted groups to opt-out
- **AND** still checks group authentication and manager authorization

### Requirement: Manager Authorization for Restricted Commands
Commands marked as manager-only SHALL verify the caller is the group manager.

#### Scenario: Manager authorization check
- **WHEN** user sends `/status` or `/unlink`
- **THEN** bot calls `isGroupManager(chatId, userId)` to verify authorization
- **AND** proceeds if user is the manager who configured the group
- **AND** rejects with authorization error otherwise

### Requirement: Helper Functions for Statistics
The bot SHALL provide helper functions to format statistics and gather operational data.

#### Scenario: Format uptime
- **WHEN** `formatUptime(seconds)` is called with process uptime
- **THEN** returns human-readable format like "2d 5h 30m"

#### Scenario: Format operations breakdown
- **WHEN** `formatOperationsBreakdown(operations)` is called with operation list
- **THEN** groups operations by type (bugs, tasks, ideas)
- **AND** returns formatted string like "🐛 50 bugs, 🫡 30 tasks, 🦄 20 ideas"

#### Scenario: Gather operation statistics
- **WHEN** `gatherOperationStats(groupId)` is called
- **THEN** queries `OperationsRepository` for each status (completed, failed, pending)
- **AND** returns object with total, counts by status, and breakdown by type
