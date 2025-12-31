# LLM Evaluation with Promptfoo

This document explains how to evaluate and test the AI behavior of TeleGit using Promptfoo.

## Overview

**Promptfoo** is an LLM evaluation framework that tests AI behavior against expected outcomes. Unlike unit tests (which test application logic), Promptfoo evaluations verify that the LLM produces correct and consistent results.

### Why Promptfoo?

1. **Systematic Testing** - Test LLM outputs against 27+ real-world scenarios
2. **Model Comparison** - Compare different models (GPT-4, GPT-3.5, etc.)
3. **Regression Prevention** - Detect when prompt changes break existing behavior
4. **Metrics & Reporting** - Track accuracy, confidence scores, and failure modes
5. **CI/CD Integration** - Automate LLM testing in deployment pipelines

## Quick Start

### Prerequisites

You need an OpenAI API key to run Promptfoo evaluations.

### Setup

**Option 1: Environment Variable (Temporary)**
```bash
export OPENAI_API_KEY=sk-proj-your-api-key-here
```

**Option 2: Add to .env file (Persistent)**
```bash
echo "OPENAI_API_KEY=sk-proj-your-api-key-here" >> .env
```

> **Note**: The `.env` file is gitignored and safe for personal API keys.

### Run Evaluations

```bash
# Run intent classification evaluation
npx promptfoo eval -c test/promptfoo/intent-classification.yaml

# View results in terminal
npx promptfoo view

# Open interactive web UI
npx promptfoo view --share
```

## Evaluation Structure

### Files

```
test/promptfoo/
├── intent-classification.yaml    # Main evaluation config
└── ...                            # Future: workflow-evaluation.yaml, etc.
```

### Intent Classification Evaluation

The `intent-classification.yaml` file tests the core AI feature: understanding user messages and classifying their intent.

**Test Coverage** (27 test cases):

1. **Bug Detection** (3 tests)
   - Simple bug reports
   - Error messages with stack traces
   - Implicit bugs without explicit keywords

2. **Task Detection** (3 tests)
   - TODO-style tasks
   - Action-oriented language
   - Implementation requests

3. **Idea Detection** (3 tests)
   - Feature requests
   - Enhancement suggestions
   - Brainstorming messages

4. **Update Issue Detection** (2 tests)
   - Explicit issue references (#42)
   - Status updates (close, reopen)

5. **Search Issues Detection** (2 tests)
   - Search queries
   - Finding existing issues

6. **Unknown Intent Detection** (2 tests)
   - Casual conversation
   - Ambiguous messages

7. **Entity Extraction** (3 tests)
   - Hashtag labels (#bug, #urgent)
   - Mention assignees (@user)
   - Issue number extraction

8. **Context Handling** (1 test)
   - Conversation thread awareness
   - Context-based classification

9. **Edge Cases** (2 tests)
   - Very long messages
   - Special characters

### Models Tested

The evaluation runs against multiple models:

- `openai:gpt-4` - High accuracy, higher cost
- `openai:gpt-3.5-turbo` - Fast, cost-effective

**Configuration**:
```yaml
providers:
  - id: openai:gpt-4
    config:
      temperature: 0.3
      max_tokens: 500
  - id: openai:gpt-3.5-turbo
    config:
      temperature: 0.3
      max_tokens: 500
```

## Understanding Results

### Assertion Types

Promptfoo uses JavaScript-based assertions to validate LLM outputs:

#### 1. Intent Classification

```yaml
assert:
  - type: javascript
    value: |
      const output = JSON.parse(vars.output);
      output.intent === 'create_bug' &&
      output.confidence >= 0.7
```

Verifies:
- Intent is correctly classified
- Confidence score meets threshold (≥0.7 for clear cases)

#### 2. Entity Extraction

```yaml
assert:
  - type: javascript
    value: |
      const output = JSON.parse(vars.output);
      output.entities.labels.includes('bug') &&
      output.entities.labels.includes('urgent')
```

Verifies:
- Hashtags extracted correctly
- Required entities present

#### 3. Title Generation

```yaml
assert:
  - type: javascript
    value: |
      const output = JSON.parse(vars.output);
      output.entities.title.length <= 60
```

Verifies:
- Generated titles respect character limits
- Titles contain relevant keywords

### Reading Evaluation Output

```bash
┌─────────────────────────────────────────────────────────────┐
│ Intent Classification Accuracy Evaluation                   │
│ Models: gpt-4, gpt-3.5-turbo                               │
│ Tests: 27 scenarios                                         │
└─────────────────────────────────────────────────────────────┘

Summary:
  ✓ Bug Detection:          3/3 passed (100%)
  ✓ Task Detection:         3/3 passed (100%)
  ✓ Idea Detection:         3/3 passed (100%)
  ✓ Update Detection:       2/2 passed (100%)
  ✓ Search Detection:       2/2 passed (100%)
  ✓ Unknown Intent:         2/2 passed (100%)
  ✓ Entity Extraction:      3/3 passed (100%)
  ✓ Context Handling:       1/1 passed (100%)
  ✓ Edge Cases:             2/2 passed (100%)

Overall: 27/27 tests passed (100%)
Target: >80% accuracy

Model Comparison:
  - gpt-4:           27/27 (100%) - ⭐ Recommended
  - gpt-3.5-turbo:   25/27 (93%)  - Cost-effective alternative
```

### Success Criteria

- **Overall accuracy**: >80% across all intent types
- **Critical intents**: 100% for bug, task, idea classification
- **Confidence scores**: ≥0.7 for clear intents, ≥0.3 for ambiguous
- **Entity extraction**: 100% for hashtags and mentions
- **No regressions**: New prompts should not break existing tests

## Prompt Development Workflow

### 1. Identify Issue

```bash
# Run evaluation to find failing tests
npx promptfoo eval -c test/promptfoo/intent-classification.yaml

# Specific scenario is failing
# Example: "Feature requests are misclassified as tasks"
```

### 2. Update Prompt

Edit the prompt template:

```bash
# Edit prompt file
vim prompts/intent-classification.txt
```

Example change:
```diff
  ## Intent Types

- - create_idea: Feature requests and enhancement suggestions
+ - create_idea: Feature requests, "what if" suggestions, enhancement ideas,
+   and product improvements (NOT implementation tasks)
```

### 3. Test Changes

```bash
# Re-run evaluation
npx promptfoo eval -c test/promptfoo/intent-classification.yaml

# Compare before/after results
npx promptfoo view --diff
```

### 4. Iterate

Continue refining until all tests pass with >80% accuracy.

### 5. Document

Add new test cases for edge cases discovered:

```yaml
# Add to test/promptfoo/intent-classification.yaml
tests:
  - description: "Feature idea vs implementation task distinction"
    vars:
      message: "We should add a dark mode feature"  # Idea, not task
    assert:
      - type: javascript
        value: output.intent === 'create_idea'
```

## Adding New Evaluations

### Create New Evaluation File

```bash
# Create evaluation for GitHub issue formatting
touch test/promptfoo/issue-format-evaluation.yaml
```

### Example Structure

```yaml
description: "GitHub Issue Formatting Quality"

prompts:
  - file://../../prompts/issue-formatting.txt

providers:
  - openai:gpt-4

tests:
  - description: "Should format bug report correctly"
    vars:
      intent: "create_bug"
      title: "Login button broken"
      description: "500 error when clicking login"
    assert:
      - type: javascript
        value: |
          const output = JSON.parse(vars.output);
          output.includes('## Bug Report') &&
          output.includes('**Steps to Reproduce:**')

  - description: "Should include labels"
    vars:
      intent: "create_bug"
      labels: ["bug", "urgent"]
    assert:
      - type: javascript
        value: output.includes('Labels: bug, urgent')
```

### Run New Evaluation

```bash
npx promptfoo eval -c test/promptfoo/issue-format-evaluation.yaml
```

## Cost Management

### Estimating Costs

Promptfoo provides cost estimates:

```bash
# Preview costs before running
npx promptfoo eval -c test/promptfoo/intent-classification.yaml --dry-run

# Estimated cost:
# - gpt-4: $0.15 (27 tests × ~200 tokens)
# - gpt-3.5-turbo: $0.02
```

### Reducing Costs

**1. Use Smaller Models for Development**

```yaml
# Test with gpt-3.5-turbo first
providers:
  - openai:gpt-3.5-turbo  # Faster, cheaper
```

**2. Test Specific Scenarios**

```bash
# Run only failing tests
npx promptfoo eval -c test/promptfoo/intent-classification.yaml --filter "Bug Detection"
```

**3. Use Caching**

Promptfoo caches results to avoid re-running unchanged tests.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: LLM Evaluation

on:
  pull_request:
    paths:
      - 'prompts/**'
      - 'test/promptfoo/**'

jobs:
  promptfoo-eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm install

      - name: Run Promptfoo evaluation
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: |
          npx promptfoo eval -c test/promptfoo/intent-classification.yaml

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: promptfoo-results
          path: promptfoo-results/
```

### Quality Gates

Fail CI if accuracy drops below threshold:

```bash
# Extract pass rate and fail if below 80%
npx promptfoo eval -c test/promptfoo/intent-classification.yaml --json > results.json
PASS_RATE=$(jq '.stats.pass_rate' results.json)

if [ $(echo "$PASS_RATE < 0.80" | bc) -eq 1 ]; then
  echo "❌ Evaluation failed: Pass rate $PASS_RATE < 80%"
  exit 1
fi
```

## Best Practices

### 1. Version Control Prompts

Track prompt changes in git:

```bash
git add prompts/intent-classification.txt
git commit -m "Improve idea vs task distinction in intent classification"
```

### 2. Document Test Rationale

Add comments explaining why tests exist:

```yaml
tests:
  # Edge case: User says "we should" which could be idea or task
  - description: "Should classify suggestions as ideas, not tasks"
    vars:
      message: "We should add dark mode"
    assert:
      - type: javascript
        value: output.intent === 'create_idea'
```

### 3. Test Both Positive and Negative Cases

```yaml
tests:
  # Positive: Should match
  - description: "Clear bug report"
    vars:
      message: "The app crashes on startup #bug"
    assert:
      - type: javascript
        value: output.intent === 'create_bug'

  # Negative: Should NOT match
  - description: "Not a bug, just a question"
    vars:
      message: "How do I use this feature?"
    assert:
      - type: javascript
        value: output.intent !== 'create_bug'
```

### 4. Track Metrics Over Time

```bash
# Save results with timestamps
npx promptfoo eval -c test/promptfoo/intent-classification.yaml
cp promptfoo-results/intent-classification-report.json \
   promptfoo-results/intent-classification-$(date +%Y%m%d).json
```

### 5. Compare Prompt Versions

```bash
# Evaluate old vs new prompt
npx promptfoo eval \
  --prompts "prompts/intent-classification-v1.txt,prompts/intent-classification-v2.txt" \
  --config test/promptfoo/intent-classification.yaml
```

## Troubleshooting

### "API key not found"

**Solution**: Set your OpenAI API key:
```bash
export OPENAI_API_KEY=sk-proj-your-key-here
```

### "Rate limit exceeded"

**Solution**: Add delays between requests:
```yaml
# In your config file
providers:
  - openai:gpt-4
    config:
      delay: 1000  # 1 second delay between requests
```

### "Assertion failed"

**Solution**: Check the output format:
```bash
# View raw LLM output
npx promptfoo eval -c test/promptfoo/intent-classification.yaml --verbose

# Debug specific test
npx promptfoo eval --filter "Bug Detection" --verbose
```

## Resources

- **Promptfoo Docs**: https://promptfoo.dev/docs/intro
- **Example Configs**: https://github.com/promptfoo/promptfoo/tree/main/examples
- **Assertion Types**: https://promptfoo.dev/docs/configuration/expected-outputs/

## Next Steps

- For unit testing, see [TESTING.md](./TESTING.md)
- For contribution guidelines, see [README.md](./README.md)
- For AI assistant guidelines, see [CLAUDE.md](./CLAUDE.md)
