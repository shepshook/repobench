import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchProgressReporter } from '../../../src/core/services/batch-progress-reporter';
import { WorkerResult, BatchRunSummary, AgentRunSummary } from '../../../src/core/contracts';

describe('BatchProgressReporter', () => {
  let reporter: BatchProgressReporter;
  let logSpy: any;
  let tableSpy: any;

  beforeEach(() => {
    reporter = new BatchProgressReporter();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    tableSpy = vi.spyOn(console, 'table').mockImplementation(() => {});
  });

  it('should print start message onTaskStart', () => {
    reporter.onTaskStart('task-1', 'agent-1', 'cand-1');
    expect(logSpy).toHaveBeenCalledWith('[agent-1] Processing candidate cand-1...');
  });

  it('should print success message onTaskComplete when fulfilled', () => {
    const result: WorkerResult<any> = {
      id: 'task-1',
      status: 'fulfilled',
      value: { success: true },
    };
    reporter.onTaskComplete('task-1', result);
    expect(logSpy).toHaveBeenCalledWith('[agent-1] Done — success');
  });

  it('should print failed message onTaskComplete when rejected', () => {
    const result: WorkerResult<any> = {
      id: 'task-1',
      status: 'rejected',
      error: new Error('Failed'),
    };
    // Note: reporter needs agentId to print the message. 
    // The spec says onTaskComplete(taskId: string, result: WorkerResult<unknown>): void
    // But the print output should be [agentId] Done.
    // This implies the reporter needs to track which task belongs to which agent.
    
    // First start the task to associate it with an agent
    reporter.onTaskStart('task-1', 'agent-1', 'cand-1');
    reporter.onTaskComplete('task-1', result);
    expect(logSpy).toHaveBeenCalledWith('[agent-1] Done — failed');
  });

  it('should print error message on onError', () => {
    const error = new Error('Critical Failure');
    reporter.onError('task-1', error);
    expect(logSpy).toHaveBeenCalledWith('[task-1] Error: Critical Failure');
  });

  it('should render summary table on onBatchComplete', () => {
    const summary: BatchRunSummary = {
      totalRuns: 10,
      successfulRuns: 8,
      failedRuns: 2,
      results: new Map([
        ['agent-1', { 
          agentId: 'agent-1', 
          totalRuns: 5, 
          successfulRuns: 4, 
          avgEScore: 0.8, 
          avgCost: 10, 
          avgLatency: 100 
        } as AgentRunSummary],
      ]),
      totalDuration: 1000,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    reporter.onBatchComplete(summary);
    
    expect(tableSpy).toHaveBeenCalled();
    const tableData = tableSpy.mock.calls[0][0];
    expect(tableData).toEqual(expect.arrayContaining([
      expect.objectContaining({
        'Agent ID': 'agent-1',
        'Runs': 5,
        'Passed': 4,
        'Failed': 1,
        'Avg E-Score': 0.8,
        'Avg Cost': 10,
        'Avg Latency': 100,
      })
    ]));
  });
});
