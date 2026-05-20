import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { Worker } from 'node:worker_threads';
import { IAgentAdapter } from '../../src/core/contracts';

vi.mock('node:worker_threads', () => {
  class MockWorker {
    listeners = {};
    on = vi.fn((event, callback) => {
      this.listeners[event] = callback;
    });
    postMessage = vi.fn((message) => {
      if (message.type === 'spawn') {
        setTimeout(() => {
          if (this.listeners['message']) {
            this.listeners['message']({
              type: 'response',
              id: message.id,
              result: { status: 'ok' },
            });
          }
        }, 10);
      }
    });
    terminate = vi.fn();
  }
  return { Worker: MockWorker };
});

vi.mock('../../src/infrastructure/sandbox', () => {
  class MockSandbox {
    config = { project: 'test-project', envVars: {} };
    isSimulation = true;
    registerSession = vi.fn();
    unregisterSession = vi.fn();
    getContainer = () => ({ id: 'mock-container' });
  }
  return { Sandbox: MockSandbox };
});

describe('PtySession PromptHandler Integration', () => {
  let sandbox: Sandbox;
  let mockAdapter: IAgentAdapter;
  let session: PtySession;
  let workerInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    sandbox = new Sandbox({} as any);
    
    mockAdapter = {
      interactionMap: new Map([
        ['Confirm\\? \\[y/n\\]', 'y'],
        ['Enter name:', 'RepoBenchAgent'],
      ]),
      getStartupCommand: () => 'bash',
    };

    // We need to capture the worker instance created by PtySession.create
    // Since Worker is mocked, we can get it from the mock calls.
    session = await PtySession.create(sandbox, mockAdapter);
    
    // Get the worker instance that was created
    workerInstance = (session as any).worker;

  });

  it('should automatically write a response when a prompt is matched in incoming data', async () => {
    // Mock the session.write method to track calls
    const writeSpy = vi.spyOn(session, 'write');
    
    // Find the 'message' listener registered by PtySession
    const messageListener = workerInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    
    // Simulate incoming data from the worker
    messageListener({
      type: 'data',
      data: 'Some output... Confirm? [y/n]',
    });

    expect(writeSpy).toHaveBeenCalledWith('y\n');
  });

  it('should handle fragmented prompts across multiple data messages', async () => {
    const writeSpy = vi.spyOn(session, 'write');
    const messageListener = workerInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    
    // Send prompt in chunks
    messageListener({ type: 'data', data: 'Confirm' });
    messageListener({ type: 'data', data: '? [y/n]' });

    expect(writeSpy).toHaveBeenCalledWith('y\n');
  });

  it('should not write a response when no prompt matches', async () => {
    const writeSpy = vi.spyOn(session, 'write');
    const messageListener = workerInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    
    messageListener({
      type: 'data',
      data: 'Just some random output without any prompts',
    });

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('should allow updating interaction rules for an active session', async () => {
    const writeSpy = vi.spyOn(session, 'write');
    
    // This should ideally be possible, but IPtySession doesn't currently expose setRules
    // We cast to any to see if the implementation exists
    const rules: any[] = [
      { pattern: 'New Prompt:', response: 'new-response' },
    ];
    
    if ((session as any).promptHandler) {
      (session as any).promptHandler.setRules(rules);
    } else {
      throw new Error('PtySession does not have a promptHandler');
    }
    
    const messageListener = workerInstance.on.mock.calls.find((call: any) => call[0] === 'message')[1];
    messageListener({ type: 'data', data: 'New Prompt:' });

    expect(writeSpy).toHaveBeenCalledWith('new-response\n');
  });
});
