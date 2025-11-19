/**
 * LangGraph Workflow Graph
 * Orchestrates the AI processing workflow with conditional routing
 *
 * Task 4.3.1: Implement LangGraph Workflow Graph
 */

import { StateGraph, END } from '@langchain/langgraph';
import { WorkflowState, WorkflowStatus, IntentType } from './state-schema.js';
import { analyzeNode } from './nodes/analyze.js';
import { formatNode } from './nodes/format.js';
import { storeNode } from './nodes/store.js';
import { notifyNode } from './nodes/notify.js';
import { errorNode } from './nodes/error.js';
import { getConfig } from '../../config/env.js';

/**
 * Creates the LangGraph workflow
 *
 * @returns {StateGraph} Compiled workflow graph
 */
export function createWorkflow() {
  // Initialize workflow graph with state schema
  const workflow = new StateGraph(WorkflowState);

  // Add nodes to the graph
  workflow.addNode('analyze', analyzeNode);
  workflow.addNode('format', formatNode);
  workflow.addNode('store', storeNode);
  workflow.addNode('notify', notifyNode);
  workflow.addNode('error', errorNode);

  // Set entry point
  workflow.setEntryPoint('analyze');

  // Add conditional edges from analyze node
  workflow.addConditionalEdges('analyze', routeAfterAnalysis, {
    format: 'format',
    error: 'error',
    unknown: END,
  });

  // Add edges from format node
  workflow.addEdge('format', 'store');

  // Add edges from store node
  workflow.addEdge('store', 'notify');

  // Add edges from notify node
  workflow.addEdge('notify', END);

  // Add edge from error node
  workflow.addEdge('error', END);

  // Compile the workflow
  return workflow.compile();
}

/**
 * Routes the workflow after intent analysis
 * Determines the next node based on the classified intent
 *
 * @param {Object} state - Current workflow state
 * @returns {string} Next node to execute
 */
function routeAfterAnalysis(state) {
  // Check for errors during analysis
  if (state.error) {
    return 'error';
  }

  // Check if intent was classified
  if (!state.intent || state.intent.intent === IntentType.UNKNOWN) {
    // For unknown intents, end workflow (no GitHub action needed)
    return 'unknown';
  }

  // Check confidence threshold
  const config = getConfig();
  const threshold = config.llm.intentConfidenceThreshold;

  if (state.intent.confidence < threshold) {
    // Low confidence - treat as unknown
    return 'unknown';
  }

  // Route to format node for all actionable intents
  // Note: In a complete implementation with Phase 5 (GitHub MCP Integration),
  // we would route to search/create/update nodes here based on intent type.
  // For now, we route to format which prepares the data for future GitHub operations.
  return 'format';
}

/**
 * Executes the workflow with the given initial state
 *
 * @param {Object} initialState - Initial workflow state
 * @returns {Promise<Object>} Final workflow state
 * @throws {Error} If workflow execution fails
 */
export async function executeWorkflow(initialState) {
  try {
    const workflow = createWorkflow();
    const result = await workflow.invoke(initialState);
    return result;
  } catch (error) {
    console.error('Workflow execution error:', error);

    // Return error state
    return {
      ...initialState,
      error: {
        message: error.message,
        code: 'WORKFLOW_EXECUTION_ERROR',
        details: error.stack,
      },
      status: WorkflowStatus.ERROR,
      timestamps: {
        ...initialState.timestamps,
        completedAt: Date.now(),
      },
    };
  }
}

/**
 * Gets workflow statistics
 * Useful for monitoring and debugging
 *
 * @param {Object} state - Workflow state
 * @returns {Object} Workflow statistics
 */
export function getWorkflowStats(state) {
  const { timestamps } = state;

  return {
    totalDuration: timestamps.completedAt ? timestamps.completedAt - timestamps.startedAt : null,
    analysisDuration: timestamps.analyzedAt ? timestamps.analyzedAt - timestamps.startedAt : null,
    executionDuration: timestamps.executedAt ? timestamps.executedAt - timestamps.analyzedAt : null,
    notificationDuration: timestamps.completedAt && timestamps.executedAt
      ? timestamps.completedAt - timestamps.executedAt
      : null,
    status: state.status,
    intent: state.intent?.intent || 'unknown',
    confidence: state.intent?.confidence || 0,
    success: state.status === WorkflowStatus.COMPLETED && !state.error,
  };
}
