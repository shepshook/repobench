import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { AiderAdapter } from '../../src/infrastructure/agents/aider-adapter';
import { DefaultAdapter } from '../../src/core/services/base-agent-adapter';
import { Worker } from 'node:worker_threads';

vi.mock('node:worker_threads', () => {
  class MockWorker {
    messageHandler: any;
    on(event: string, handler: any) {
      if (event === 'message') this.messageHandler = handler;
    }
    postMessage(message: any) {
      if (message.type === 'request') {
        // Automatically respond to requests to avoid timeouts
        setTimeout(() => {
          if (this.messageHandler) {
            this.messageHandler({
              type: 'response',
              id: message.id,
              result: {},
            });
          }
        }, 10);
      } else if (message.type === 'spawn') {
        // Handled similarly if spawn is sent as a request (it is in this case)
        setTimeout(() => {
          if (this.messageHandler) {
            this.messageHandler({
              type: 'response',
              id: message.id,
              result: {},
            });
          }
        }, 10);
      }
    }
    terminate = vi.fn();
  }
  return { Worker: MockWorker };
});

describe('PtySession Configuration Integration', () => {
  let mockSandbox: Sandbox;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox = {
      config: { envVars: {} },
      registerSession: vi.fn(),
      unregisterSession: vi.fn(),
      isSimulation: false,
      getContainer: vi.fn().mockReturnValue({ id: 'test-container' }),
    } as unknown as Sandbox;
  });

  it('should not duplicate cliArgs when adapter already includes them in startup command', async () => {
    const adapter = new AiderAdapter();
    const config = {
      cliArgs: ['--verbose', '--debug'],
    };
    adapter.configure(config as any);

    // We want to verify what is passed to sendRequest('spawn', ...)
    // Since initializeSession is private, we can spy on the PtySession prototype
    const sendRequestSpy = vi.spyOn(PtySession.prototype, 'sendRequest' as any);

    await PtySession.create(mockSandbox, adapter, { args: config.cliArgs });

    const spawnRequest = sendRequestSpy.mock.calls.find(call => call[0] === 'spawn');
    expect(spawnRequest).toBeDefined();
    
    const args = spawnRequest![1].options.args;
    
    // Expected: ['aider', 'aider', '--no-git', '--verbose', '--debug'] 
    // Wait, the current implementation does:
    // startupCmd = "aider --no-git --verbose --debug"
    // name = "aider", baseArgs = ["--no-git", "--verbose", "--debug"]
    // actualArgs = [...baseArgs, ...config.cliArgs] = ["--no-git", "--verbose", "--debug", "--verbose", "--debug"]
    // final args = [actualName, ...actualArgs] = ["aider", "--no-git", "--verbose", "--debug", "--verbose", "--debug"]
    
    // We expect no duplication
    const verboseCount = args.filter(arg => arg === '--verbose').length;
    const debugCount = args.filter(arg => arg === '--debug').length;
    
    expect(verboseCount).toBe(1);
    expect(debugCount).toBe(1);
  });

  it('should correctly apply cliArgs when using DefaultAdapter', async () => {
    const adapter = new DefaultAdapter('test-agent', 'sh');
    const config = {
      cliArgs: ['-x', '-v'],
    };
    adapter.configure(config as any);

    const sendRequestSpy = vi.spyOn(PtySession.prototype, 'sendRequest' as any);

    await PtySession.create(mockSandbox, adapter, { args: config.cliArgs });

    const spawnRequest = sendRequestSpy.mock.calls.find(call => call[0] === 'spawn');
    const args = spawnRequest![1].options.args;
    
    // DefaultAdapter.configure updates _startupCmd: "sh -x -v"
    // PtySession.create: name="sh", baseArgs=["-x", "-v"]
    // actualArgs = [...baseArgs, ...config.cliArgs] = ["-x", "-v", "-x", "-v"]
    // final args = ["sh", "-x", "-v", "-x", "-v"]
    
    expect(args.filter(arg => arg === '-x').length).toBe(1);
    expect(args.filter(arg => arg === '-v').length).toBe(1);
  });
});
