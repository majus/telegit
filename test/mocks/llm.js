/**
 * Mock data generators for LLM/AI responses
 * Using @faker-js/faker for realistic test data
 */

import { faker } from '@faker-js/faker';

/**
 * Generate a mock classification result
 * @param {'issue'|'bug'|'idea'|'question'|'ignore'} type - Classification type
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock classifier output
 */
export function mockClassification(type = 'issue', overrides = {}) {
  const templates = {
    bug: {
      classification: 'bug',
      confidence: faker.number.float({ min: 0.8, max: 1.0, fractionDigits: 2 }),
      reasoning: 'Message describes a malfunction or error in the system',
      suggestedTitle: 'Fix: ' + faker.lorem.words(5),
      suggestedLabels: ['bug', 'needs-investigation'],
      suggestedBody: faker.lorem.paragraph(),
    },
    issue: {
      classification: 'issue',
      confidence: faker.number.float({ min: 0.7, max: 0.95, fractionDigits: 2 }),
      reasoning: 'Message describes a problem that needs attention',
      suggestedTitle: faker.lorem.words(5),
      suggestedLabels: ['issue'],
      suggestedBody: faker.lorem.paragraph(),
    },
    idea: {
      classification: 'idea',
      confidence: faker.number.float({ min: 0.75, max: 1.0, fractionDigits: 2 }),
      reasoning: 'Message contains a feature request or suggestion',
      suggestedTitle: 'Feature: ' + faker.lorem.words(5),
      suggestedLabels: ['enhancement', 'idea'],
      suggestedBody: faker.lorem.paragraph(),
    },
    question: {
      classification: 'question',
      confidence: faker.number.float({ min: 0.7, max: 0.95, fractionDigits: 2 }),
      reasoning: 'Message is asking for information or clarification',
      suggestedTitle: 'Question: ' + faker.lorem.words(5),
      suggestedLabels: ['question'],
      suggestedBody: faker.lorem.paragraph(),
    },
    ignore: {
      classification: 'ignore',
      confidence: faker.number.float({ min: 0.85, max: 1.0, fractionDigits: 2 }),
      reasoning: 'Message is casual conversation not relevant to issue tracking',
      suggestedTitle: null,
      suggestedLabels: [],
      suggestedBody: null,
    },
  };

  return {
    ...templates[type],
    ...overrides,
  };
}

/**
 * Generate a mock issue formatter output
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock issue formatter output
 */
export function mockIssueFormat(overrides = {}) {
  return {
    title: overrides.title || faker.lorem.sentence(),
    body: overrides.body || faker.lorem.paragraphs(2),
    labels: overrides.labels || ['telegram', 'auto-created'],
    ...overrides,
  };
}

/**
 * Generate a mock graph state
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock graph state
 */
export function mockGraphState(overrides = {}) {
  return {
    messageText: faker.lorem.sentence(),
    classification: undefined,
    issueData: undefined,
    githubResult: undefined,
    error: undefined,
    ...overrides,
  };
}

/**
 * Generate a mock processing result (success)
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock processing result
 */
export function mockProcessingSuccess(overrides = {}) {
  return {
    success: true,
    classification: mockClassification('issue'),
    issueCreated: {
      number: faker.number.int({ min: 1, max: 9999 }),
      url: `https://github.com/owner/repo/issues/${faker.number.int({ min: 1, max: 9999 })}`,
      title: faker.lorem.sentence(),
    },
    error: undefined,
    ...overrides,
  };
}

/**
 * Generate a mock processing result (failure)
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock processing result
 */
export function mockProcessingError(overrides = {}) {
  const errors = [
    'Failed to connect to GitHub API',
    'Rate limit exceeded',
    'Invalid authentication token',
    'Network timeout',
  ];

  return {
    success: false,
    classification: undefined,
    issueCreated: undefined,
    error: faker.helpers.arrayElement(errors),
    ...overrides,
  };
}

/**
 * Generate a mock LLM response (raw OpenAI format)
 * @param {string} content - Response content
 * @returns {object} Mock LLM response
 */
export function mockLLMResponse(content) {
  return {
    id: faker.string.alphanumeric(32),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: faker.number.int({ min: 10, max: 100 }),
      completion_tokens: faker.number.int({ min: 10, max: 200 }),
      total_tokens: faker.number.int({ min: 20, max: 300 }),
    },
  };
}
