import { IProgressReporter, BatchRunSummary, WorkerResult } from '../contracts';

export class BatchProgressReporter implements IProgressReporter {
  private taskAgentMap = new Map<string, string>();

  onTaskStart(taskId: string, agentId: string, candidateId: string): void {
    this.taskAgentMap.set(taskId, agentId);
    console.log(`[${agentId}] Processing candidate ${candidateId}...`);
  }

  onTaskComplete(taskId: string, result: WorkerResult<unknown>): void {
    const agentId = this.taskAgentMap.get(taskId) || 'agent-1';
    const status = result.status === 'fulfilled' ? 'success' : 'failed';
    console.log(`[${agentId}] Done — ${status}`);
    this.taskAgentMap.delete(taskId);
  }

  onBatchComplete(summary: BatchRunSummary): void {
    const tableData = Array.from(summary.results.values()).map(agent => ({
      'Agent ID': agent.agentId,
      'Runs': agent.totalRuns,
      'Passed': agent.successfulRuns,
      'Failed': agent.totalRuns - agent.successfulRuns,
      'Avg E-Score': agent.avgEScore,
      'Avg Cost': agent.avgCost,
      'Avg Latency': agent.avgLatency,
    }));

    console.table(tableData);
  }

  onError(taskId: string, error: Error): void {
    console.log(`[${taskId}] Error: ${error.message}`);
  }
}
