/**
 * Mock data generators for GitHub objects
 * Using @faker-js/faker for realistic test data
 */

import { faker } from '@faker-js/faker';

/**
 * Generate a mock GitHub user
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock GitHub user
 */
export function mockGitHubUser(overrides = {}) {
  const username = faker.internet.username();
  return {
    login: username,
    id: faker.number.int({ min: 1, max: 999999999 }),
    node_id: faker.string.alphanumeric(20),
    avatar_url: faker.image.avatar(),
    url: `https://api.github.com/users/${username}`,
    html_url: `https://github.com/${username}`,
    type: 'User',
    ...overrides,
  };
}

/**
 * Generate a mock GitHub label
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock GitHub label
 */
export function mockGitHubLabel(overrides = {}) {
  const labels = [
    { name: 'bug', color: 'd73a4a', description: 'Something isn\'t working' },
    { name: 'enhancement', color: 'a2eeef', description: 'New feature or request' },
    { name: 'question', color: 'd876e3', description: 'Further information is requested' },
    { name: 'documentation', color: '0075ca', description: 'Improvements or additions to documentation' },
    { name: 'good first issue', color: '7057ff', description: 'Good for newcomers' },
  ];

  const label = faker.helpers.arrayElement(labels);
  return {
    id: faker.number.int({ min: 1, max: 999999999 }),
    node_id: faker.string.alphanumeric(20),
    url: `https://api.github.com/repos/owner/repo/labels/${label.name}`,
    name: label.name,
    color: label.color,
    default: false,
    description: label.description,
    ...overrides,
  };
}

/**
 * Generate a mock GitHub issue
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock GitHub issue
 */
export function mockGitHubIssue(overrides = {}) {
  const number = faker.number.int({ min: 1, max: 9999 });
  const title = overrides.title || faker.lorem.sentence();

  return {
    id: faker.number.int({ min: 1, max: 999999999 }),
    node_id: faker.string.alphanumeric(20),
    url: `https://api.github.com/repos/owner/repo/issues/${number}`,
    html_url: `https://github.com/owner/repo/issues/${number}`,
    number: number,
    state: 'open',
    title: title,
    body: faker.lorem.paragraphs(2),
    user: mockGitHubUser(),
    labels: [mockGitHubLabel()],
    assignee: null,
    assignees: [],
    milestone: null,
    locked: false,
    comments: 0,
    created_at: faker.date.recent({ days: 7 }).toISOString(),
    updated_at: faker.date.recent({ days: 1 }).toISOString(),
    closed_at: null,
    ...overrides,
  };
}

/**
 * Generate a mock GitHub comment
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock GitHub comment
 */
export function mockGitHubComment(overrides = {}) {
  const id = faker.number.int({ min: 1, max: 999999999 });

  return {
    id: id,
    node_id: faker.string.alphanumeric(20),
    url: `https://api.github.com/repos/owner/repo/issues/comments/${id}`,
    html_url: `https://github.com/owner/repo/issues/1#issuecomment-${id}`,
    body: faker.lorem.paragraph(),
    user: mockGitHubUser(),
    created_at: faker.date.recent({ days: 1 }).toISOString(),
    updated_at: faker.date.recent({ hours: 1 }).toISOString(),
    ...overrides,
  };
}

/**
 * Generate a mock GitHub repository
 * @param {Partial<object>} overrides - Override specific fields
 * @returns {object} Mock GitHub repository
 */
export function mockGitHubRepository(overrides = {}) {
  const name = faker.lorem.slug();
  const owner = overrides.owner || mockGitHubUser();

  return {
    id: faker.number.int({ min: 1, max: 999999999 }),
    node_id: faker.string.alphanumeric(20),
    name: name,
    full_name: `${owner.login}/${name}`,
    owner: owner,
    private: false,
    html_url: `https://github.com/${owner.login}/${name}`,
    description: faker.lorem.sentence(),
    fork: false,
    url: `https://api.github.com/repos/${owner.login}/${name}`,
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    ...overrides,
  };
}

/**
 * Generate mock GitHub issues
 * @param {number} count - Number of issues to generate
 * @returns {Array<object>} Array of mock issues
 */
export function mockGitHubIssues(count = 5) {
  return Array.from({ length: count }, () => mockGitHubIssue());
}

/**
 * Generate mock GitHub labels for classification
 * @returns {Array<object>} Array of common labels
 */
export function mockClassificationLabels() {
  return [
    mockGitHubLabel({ name: 'bug', color: 'd73a4a' }),
    mockGitHubLabel({ name: 'enhancement', color: 'a2eeef' }),
    mockGitHubLabel({ name: 'question', color: 'd876e3' }),
    mockGitHubLabel({ name: 'telegram', color: '0e8a16' }),
  ];
}
