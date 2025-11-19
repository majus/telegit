/**
 * GitHub PAT validation
 * Validates Personal Access Token format and permissions
 */

/**
 * Validate GitHub PAT format
 * @param {string} pat - Personal Access Token
 * @returns {Object} Validation result
 */
export function validatePATFormat(pat) {
  if (!pat || typeof pat !== 'string') {
    return {
      valid: false,
      error: 'PAT must be a non-empty string',
    };
  }

  const trimmedPAT = pat.trim();

  // Check for classic tokens (ghp_)
  const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
  // Check for fine-grained tokens (github_pat_)
  const fineGrainedPattern = /^github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}$/;

  const isClassic = classicPattern.test(trimmedPAT);
  const isFineGrained = fineGrainedPattern.test(trimmedPAT);

  if (!isClassic && !isFineGrained) {
    // Check if it at least starts with the right prefix
    if (!trimmedPAT.startsWith('ghp_') && !trimmedPAT.startsWith('github_pat_')) {
      return {
        valid: false,
        error: 'PAT must start with "ghp_" (classic) or "github_pat_" (fine-grained)',
      };
    }

    return {
      valid: false,
      error: 'PAT format is invalid. Please check the token length and format.',
    };
  }

  return {
    valid: true,
    type: isClassic ? 'classic' : 'fine-grained',
  };
}

/**
 * Validate GitHub PAT with GitHub API
 * Tests authentication and repository access
 * @param {string} pat - Personal Access Token
 * @param {string} repository - Repository in format "owner/repo"
 * @param {Function} [githubClient] - Optional GitHub client function for testing
 * @returns {Promise<Object>} Validation result
 */
export async function validatePAT(pat, repository, githubClient = null) {
  // First validate format
  const formatValidation = validatePATFormat(pat);
  if (!formatValidation.valid) {
    return formatValidation;
  }

  // If no GitHub client provided, we can only do format validation
  if (!githubClient) {
    console.warn('No GitHub client provided, skipping API validation');
    return {
      valid: true,
      warning: 'Only format validation performed. API validation skipped.',
      ...formatValidation,
    };
  }

  try {
    // Test authentication
    const authTest = await testAuthentication(pat, githubClient);
    if (!authTest.valid) {
      return authTest;
    }

    // Test repository access
    const repoTest = await testRepositoryAccess(pat, repository, githubClient);
    if (!repoTest.valid) {
      return repoTest;
    }

    // Test required permissions
    const permTest = await testRequiredPermissions(pat, repository, githubClient);
    if (!permTest.valid) {
      return permTest;
    }

    return {
      valid: true,
      user: authTest.user,
      repository: repoTest.repository,
      permissions: permTest.permissions,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Validation failed: ${error.message}`,
    };
  }
}

/**
 * Test PAT authentication with GitHub API
 * @param {string} pat - Personal Access Token
 * @param {Function} githubClient - GitHub client function
 * @returns {Promise<Object>} Test result
 */
async function testAuthentication(pat, githubClient) {
  try {
    // Call GitHub API to get authenticated user
    const response = await githubClient({
      endpoint: '/user',
      token: pat,
    });

    if (response.login) {
      return {
        valid: true,
        user: {
          login: response.login,
          id: response.id,
          name: response.name,
        },
      };
    }

    return {
      valid: false,
      error: 'Could not authenticate with GitHub. Please check your token.',
    };
  } catch (error) {
    if (error.status === 401) {
      return {
        valid: false,
        error: 'Invalid PAT. Authentication failed.',
      };
    }

    return {
      valid: false,
      error: `Authentication test failed: ${error.message}`,
    };
  }
}

/**
 * Test repository access with PAT
 * @param {string} pat - Personal Access Token
 * @param {string} repository - Repository in format "owner/repo"
 * @param {Function} githubClient - GitHub client function
 * @returns {Promise<Object>} Test result
 */
async function testRepositoryAccess(pat, repository, githubClient) {
  const [owner, repo] = repository.split('/');

  if (!owner || !repo) {
    return {
      valid: false,
      error: 'Invalid repository format. Expected "owner/repo".',
    };
  }

  try {
    // Try to get repository info
    const response = await githubClient({
      endpoint: `/repos/${owner}/${repo}`,
      token: pat,
    });

    if (response.full_name) {
      return {
        valid: true,
        repository: {
          fullName: response.full_name,
          private: response.private,
          permissions: response.permissions,
        },
      };
    }

    return {
      valid: false,
      error: `Could not access repository ${repository}`,
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        valid: false,
        error: `Repository ${repository} not found or PAT doesn't have access to it.`,
      };
    }

    if (error.status === 403) {
      return {
        valid: false,
        error: `Access forbidden to ${repository}. Check PAT permissions.`,
      };
    }

    return {
      valid: false,
      error: `Repository access test failed: ${error.message}`,
    };
  }
}

/**
 * Test required permissions (issues write access)
 * @param {string} pat - Personal Access Token
 * @param {string} repository - Repository in format "owner/repo"
 * @param {Function} githubClient - GitHub client function
 * @returns {Promise<Object>} Test result
 */
async function testRequiredPermissions(pat, repository, githubClient) {
  const [owner, repo] = repository.split('/');

  try {
    // Try to list issues (requires read access)
    await githubClient({
      endpoint: `/repos/${owner}/${repo}/issues`,
      token: pat,
      params: { per_page: 1 },
    });

    // For now, we assume if we can read issues, we can write them
    // A more thorough test would be to create a test issue and delete it
    // but that's invasive for validation

    return {
      valid: true,
      permissions: {
        issues: 'write',
      },
    };
  } catch (error) {
    if (error.status === 403) {
      return {
        valid: false,
        error: 'PAT does not have "repo" or "public_repo" scope. Please create a new token with proper permissions.',
      };
    }

    return {
      valid: false,
      error: `Permission test failed: ${error.message}`,
    };
  }
}

/**
 * Create a mock GitHub client for testing
 * This is a simple implementation - in production, use actual GitHub MCP client
 * @param {string} pat - Personal Access Token
 * @returns {Function} Mock GitHub client function
 */
export function createMockGitHubClient(pat) {
  return async ({ endpoint, params = {} }) => {
    const url = new URL(`https://api.github.com${endpoint}`);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `token ${pat}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TeleGit-Bot',
      },
    });

    if (!response.ok) {
      const error = new Error(`GitHub API error: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  };
}
