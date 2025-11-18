/**
 * Mock data generators for Telegram objects
 * Using @faker-js/faker for realistic test data
 */

import { faker } from '@faker-js/faker';

/**
 * Generate a mock Telegram user
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock Telegram user
 */
export function mockTelegramUser(overrides = {}) {
  return {
    id: faker.number.int({ min: 100000, max: 999999999 }),
    is_bot: false,
    first_name: faker.person.firstName(),
    last_name: faker.person.lastName(),
    username: faker.internet.username(),
    language_code: 'en',
    ...overrides,
  };
}

/**
 * Generate a mock Telegram chat
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock Telegram chat
 */
export function mockTelegramChat(overrides = {}) {
  return {
    id: faker.number.int({ min: -999999999, max: -100000 }),
    type: 'group',
    title: faker.company.name() + ' Team',
    ...overrides,
  };
}

/**
 * Generate a mock Telegram message
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock Telegram message
 */
export function mockTelegramMessage(overrides = {}) {
  const user = overrides.from || mockTelegramUser();
  const chat = overrides.chat || mockTelegramChat();

  return {
    message_id: faker.number.int({ min: 1, max: 999999 }),
    from: user,
    chat: chat,
    date: faker.date.recent().getTime() / 1000,
    text: overrides.text || faker.lorem.sentence(),
    ...overrides,
  };
}

/**
 * Generate a mock Telegram message with specific content type
 * @param {'bug'|'issue'|'idea'|'question'|'ignore'} type - Type of message
 * @returns {object} Mock Telegram message
 */
export function mockTelegramMessageByType(type) {
  const messages = {
    bug: [
      'The login button is not working on mobile devices',
      'App crashes when uploading large files',
      'Payment gateway returns error 500',
      'Users cannot reset their passwords',
    ],
    issue: [
      'Page load times are very slow on the dashboard',
      'Users are reporting problems with notifications',
      'The search feature is not returning accurate results',
      'Email delivery is delayed by several hours',
    ],
    idea: [
      'We should add dark mode to the application',
      'It would be great to have export to PDF feature',
      'Add support for multiple languages',
      'Implement two-factor authentication',
    ],
    question: [
      'How does the authentication system work?',
      'What database are we using for this project?',
      'When is the next deployment scheduled?',
      'Can someone explain the caching strategy?',
    ],
    ignore: [
      'Good morning everyone!',
      'Hey team, anyone up for lunch?',
      'Thanks for the update!',
      'See you tomorrow!',
    ],
  };

  const text = faker.helpers.arrayElement(messages[type] || messages.ignore);
  return mockTelegramMessage({ text });
}

/**
 * Generate a mock Telegram update
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock Telegram update
 */
export function mockTelegramUpdate(overrides = {}) {
  return {
    update_id: faker.number.int({ min: 1, max: 999999999 }),
    message: overrides.message || mockTelegramMessage(),
    ...overrides,
  };
}

/**
 * Generate a mock Telegram callback query
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock Telegram callback query
 */
export function mockTelegramCallbackQuery(overrides = {}) {
  return {
    id: faker.string.uuid(),
    from: mockTelegramUser(),
    message: mockTelegramMessage(),
    data: overrides.data || 'action:value',
    chat_instance: faker.string.alphanumeric(16),
    ...overrides,
  };
}

/**
 * Generate multiple mock Telegram messages
 * @param {number} count - Number of messages to generate
 * @returns {Array<object>} Array of mock messages
 */
export function mockTelegramMessages(count = 5) {
  return Array.from({ length: count }, () => mockTelegramMessage());
}

/**
 * Generate a mock Telegram message context (conversation history)
 * @param {number} messageCount - Number of messages in context
 * @returns {Array<object>} Array of mock messages representing a conversation
 */
export function mockTelegramContext(messageCount = 3) {
  const chat = mockTelegramChat();
  const users = Array.from({ length: 3 }, () => mockTelegramUser());

  return Array.from({ length: messageCount }, (_, index) => {
    return mockTelegramMessage({
      chat,
      from: faker.helpers.arrayElement(users),
      message_id: 1000 + index,
      date: (faker.date.recent().getTime() / 1000) - (messageCount - index) * 60,
    });
  });
}
