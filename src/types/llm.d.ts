/**
 * LLM and AI processing types
 */

export interface ClassifierInput {
  messageText: string;
  context?: {
    previousMessages?: string[];
    chatTitle?: string;
    username?: string;
  };
}

export interface ClassifierOutput {
  classification: 'issue' | 'bug' | 'idea' | 'question' | 'ignore';
  confidence: number;
  reasoning: string;
  suggestedTitle?: string;
  suggestedLabels?: string[];
  suggestedBody?: string;
}

export interface IssueFormatterInput {
  messageText: string;
  classification: ClassifierOutput;
  context?: {
    previousMessages?: string[];
    username?: string;
    messageLink?: string;
  };
}

export interface IssueFormatterOutput {
  title: string;
  body: string;
  labels: string[];
}

export interface LLMChainConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  streaming?: boolean;
}

export interface GraphState {
  messageText: string;
  classification?: ClassifierOutput;
  issueData?: IssueFormatterOutput;
  githubResult?: {
    issueNumber: number;
    issueUrl: string;
  };
  error?: string;
}

export type GraphNode = (state: GraphState) => Promise<Partial<GraphState>>;

export interface ProcessingResult {
  success: boolean;
  classification?: ClassifierOutput;
  issueCreated?: {
    number: number;
    url: string;
    title: string;
  };
  error?: string;
}
