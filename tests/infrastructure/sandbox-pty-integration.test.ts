import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { PtySession } from '../../src/infrastructure/pty-session';
import { createSandboxFixture, createSimulationFixture } from './fixtures';
import { waitForText } from '../../src/infrastructure/pty/test-utils';
import pty from 'node-pty';

vi.mock('node-pty', () => {
  return {
    default: {
      spawn: vi.fn().mockImplementation((cmd, args, opts) => {
        const listeners: ((data: string) => void)[] = [];
        return {
          onData: vi.fn((cb) => listeners.push(cb)),
          write: vi.fn((data: string) => {
            // Simulate echo for simple commands
            if (data.includes('echo')) {
              const match = data.match(/echo\s+["']?([^"'\n]+)["']?\n?/);
              if (match) {
                const output = match[1] + '\n';
                listeners.forEach(cb => cb(output));
              }
            }
          }),
          kill: vi.fn(),
        };
      }),
    },
  };
});

describe('Sandbox Pty Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip('should utilize Docker-native TTY (not node-pty) for command execution in Docker mode', async () => {
    const { sandbox } = createSandboxFixture();
    await sandbox.init();
    const session = await PtySession.create(sandbox);
    await session.initialize();
    
    session.write('echo native\n');
    await waitForText(session, 'native');
    expect(session.getScreenState()).toContain('native');

    // We check that the driver is indeed a DockerDriver
    expect((session as any).driver.constructor.name).toBe('DockerDriver');
    await session.close();
  }, 30000);


  it('should utilize PtySession with node-pty for command execution in Simulation mode', async () => {
    const { sandbox } = createSimulationFixture();
    await sandbox.init();

    const session = await PtySession.create(sandbox);
    session.write('echo "hello"\n');
    await waitForText(session, 'hello');
    expect(session.getScreenState()).toContain('hello');
    await session.close();
  });

  it.skip('should pass required terminal environment variables (TERM, COLUMNS, LINES)', async () => {
    // Skipped: vi.mock('node-pty') doesn't propagate to worker threads
  });

  it.skip('should provide correct spawn configuration for Simulation target', async () => {
    const { sandbox } = createSimulationFixture();
    await sandbox.init();

    await sandbox.execute('echo "hello"');

    const [name] = vi.mocked(pty.spawn).mock.calls[0];
    expect(name).toBe('bash');
  }, 15000);
});
