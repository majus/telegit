/**
 * GitHub integration types
 */

export interface GitHubIssueInput {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

export interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description?: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface GitHubCommentInput {
  issueNumber: number;
  body: string;
}

export interface GitHubCommentResponse {
  id: number;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubLabel {
  name: string;
  color: string;
  description?: string;
}

export interface GitHubSearchResult {
  total_count: number;
  items: GitHubIssueResponse[];
}

// MCP (Model Context Protocol) types
export interface MCPServerConfig {
  url: string;
  token: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}
