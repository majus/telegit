# Testing Guide

This document explains the testing strategy for TeleGit and how to run different types of tests.

## Overview

TeleGit uses a two-tier testing approach:

1. **Unit Tests (Vitest)** - Fast, offline tests for application logic
2. **LLM Evaluations (Promptfoo)** - Comprehensive AI behavior validation

## Unit Tests with Vitest

### What Unit Tests Cover

Unit tests verify application logic **without** making real API calls:

- **Input validation** - Parameter checking and error handling
- **Utility functions** - String manipulation, regex parsing, data formatting
- **Database operations** - CRUD operations with in-memory MongoDB
- **Message queue** - Rate limiting, retries, graceful shutdown
- **Encryption** - AES-256-GCM encryption/decryption
- **Error handling** - Fallback behaviors and recovery

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode (during development)
npm run test:dev

# Run with coverage report
npm run test:coverage

# Run specific test file
npx vitest test/unit/ai/helper-functions.test.js

# Run tests matching a pattern
npx vitest test/unit/database/
```

### Test Configuration

- **Test files**: `test/**/*.test.js`
- **Setup**: `test/setup.js` (runs before all tests)
- **Mocks**: `test/mocks/` (LLM, GitHub, Telegram mocks)
- **Helpers**: `test/helpers/` (MongoDB in-memory server, etc.)
- **Timeout**: 10 seconds default (configurable in `vitest.config.js`)

### Environment Variables for Tests

Unit tests use safe mock values from `.env.test`:

```bash
# These are automatically loaded - no setup needed
OPENAI_API_KEY=mock-test-api-key-no-real-calls-needed
MONGODB_URI=mongodb://localhost:27017  # Overridden by MongoMemoryServer
TELEGRAM_BOT_TOKEN=test_bot_token_123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
ENCRYPTION_KEY=0123456789abcdef...  # Fake 64-char hex key for tests
```

**Important**: Unit tests use mocks and MongoDB Memory Server. No real API keys needed!

### Writing New Unit Tests

Follow these guidelines:

#### ✅ DO: Test Application Logic

```javascript
import { describe, it, expect } from 'vitest';
import { extractHashtags, generateTitle } from '../src/ai/intent-classifier.js';

describe('Utility Functions', () => {
  it('should extract hashtags from message', () => {
    const result = extractHashtags('This is a #bug with #urgent priority');
    expect(result).toEqual(['bug', 'urgent']);
  });

  it('should generate title within 60 characters', () => {
    const longMessage = 'This is a very long message that should be truncated';
    const title = generateTitle(longMessage);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});
```

#### ❌ DON'T: Test LLM Behavior in Unit Tests

```javascript
// BAD: This makes real API calls and duplicates Promptfoo
it('should classify bug reports correctly', async () => {
  const result = await classifyIntent({
    message: 'The login button is broken #bug'
  });
  expect(result.intent).toBe('create_bug');  // Use Promptfoo for this!
});
```

**Why?** LLM behavior should be tested in Promptfoo (see `EVALUATION.md`).

### Test Structure

```
test/
├── unit/                      # Unit tests (fast, offline)
│   ├── ai/
│   │   └── helper-functions.test.js  # Utility function tests
│   ├── database/
│   │   └── repositories.test.js      # MongoDB operations
│   ├── queue/
│   │   ├── message-queue.test.js     # Queue management
│   │   └── rate-limiters.test.js     # Rate limiting
│   ├── telegram/
│   │   └── bot.test.js               # Telegram bot handlers
│   └── utils/
│       └── encryption.test.js        # Encryption utilities
├── integration/               # Integration tests
├── mocks/                     # Mock data generators
│   ├── llm.js                # LLM response mocks
│   ├── telegram.js           # Telegram API mocks
│   └── github.js             # GitHub API mocks
├── helpers/                   # Test utilities
│   └── mongodb-test-helper.js # MongoDB Memory Server
├── promptfoo/                 # LLM evaluations (see EVALUATION.md)
│   └── intent-classification.yaml
└── setup.js                   # Global test setup
```

### Test Patterns

#### Database Tests

```javascript
import { startMongoServer, stopMongoServer, getTestDb } from '../../helpers/mongodb-test-helper.js';

describe('ConfigRepository', () => {
  let db;

  beforeAll(async () => {
    const { db: testDb } = await startMongoServer('test_db');
    db = testDb;
  });

  afterAll(async () => {
    await stopMongoServer();
  });

  it('should store encrypted credentials', async () => {
    const config = await configRepo.setGroupConfig(-123456, {
      githubToken: 'ghp_secret',
      githubRepo: 'owner/repo',
      managerUserId: 789
    });

    expect(config.githubToken).toBe('ghp_secret');  // Decrypted
    // Token is encrypted in database
    const raw = await db.collection('group_configs').findOne({});
    expect(raw.encryptedGithubToken).not.toBe('ghp_secret');
  });
});
```

#### Mocking External Services

```javascript
import { vi } from 'vitest';
import { mockClassification } from '../../mocks/llm.js';

// Mock the LLM client
vi.mock('../../../src/ai/llm-client.js', () => ({
  getClassifierLLMClient: vi.fn(() => ({
    invoke: vi.fn().mockResolvedValue(mockClassification('create_bug'))
  }))
}));

describe('Intent Classifier', () => {
  it('should handle classification errors gracefully', async () => {
    // Test error handling without calling real LLM
    const result = await classifyIntent({ message: '' });
    expect(result.intent).toBe('unknown');
  });
});
```

### Continuous Integration

Unit tests run in CI/CD without any secrets:

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test  # No API keys needed!
```

### Troubleshooting

#### Tests fail with "Connection refused"

**Cause**: MongoDB Memory Server failed to start

**Solution**:
```bash
# Clear MongoDB Memory Server cache
rm -rf ~/.mongodb-memory-server

# Run tests again
npm test
```

#### Tests timeout

**Cause**: Accidentally making real API calls instead of using mocks

**Solution**: Check that you're mocking external services:
```javascript
// Verify mocks are active
console.log(vi.isMockFunction(getClassifierLLMClient)); // Should be true
```

#### Coverage is low

**Cause**: Not all code paths are tested

**Solution**:
```bash
# Generate detailed coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

## Key Principles

1. **Unit tests = Fast** - Should complete in <10 seconds total
2. **No real API calls** - Always use mocks for external services
3. **Test logic, not LLM** - Leave AI behavior to Promptfoo
4. **Isolate tests** - Each test should be independent
5. **Clear naming** - Test names should describe what they verify

## Next Steps

- For LLM evaluation testing, see [EVALUATION.md](./EVALUATION.md)
- For contribution guidelines, see [README.md](./README.md)
- For AI assistant guidelines, see [CLAUDE.md](./CLAUDE.md)
