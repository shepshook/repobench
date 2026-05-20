import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Behavioral Requirements', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-behavior-test'
    }, volumeManager);
    await sandbox.init();
  });




  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should produce ANSI escape codes for colored output (indicating a real TTY)', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          // In behavior mode, onData preserves ANSI as literal \\x1b text (keepAnsi=true)
          if (/\\x1b\[\d+m/.test(data)) {
            resolve(data);
          }
        });
      });

      // Use printf with octal escapes to produce ANSI color codes (works in busybox ash)
      await session.write("printf '\\033[32mHI\\033[0m\\n'\n");
      
      const output = await outputPromise;
      expect(output).toMatch(/\\x1b\[\d+m/);
    } finally {
      await session.close();
    }
  }, 60000);

  it('should handle carriage return characters correctly in the output stream', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        // Use onRawData because onData strips \r during normalization
        session.onRawData((data) => {
          if (data.includes('\r')) {
            resolve(data);
          }
        });
      });

      // Commands in a real PTY often return \r\n
      await session.write('echo "test"\n');
      
      const output = await outputPromise;
      expect(output).toContain('\r');
    } finally {
      await session.close();
    }
  }, 60000);

  it('should maintain session state across multiple writes', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('my-dir')) {
            resolve(data);
          }
        });
      });

      session.write('mkdir my-dir\n');
      session.write('ls\n');
      
      const output = await outputPromise;
      expect(output).toContain('my-dir');
    } finally {
      await session.close();
    }
  }, 15000);

  it('should persist current working directory (CWD) across writes', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.toLowerCase().includes('test-cwd')) {
            resolve(data);
          }
        });
      });

      session.write('mkdir test-cwd\n');
      session.write('cd test-cwd\n');
      session.write('pwd\n');
      
      const output = await outputPromise;
      expect(output).toMatch(/test-cwd/i);
    } finally {
      await session.close();
    }
  }, 15000);

  it('should persist environment variables across writes', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('state-maintenance-value')) {
            resolve(data);
          }
        });
      });

      session.write('export TEST_STATE_VAR=state-maintenance-value\n');
      session.write('echo $TEST_STATE_VAR\n');
      
      const output = await outputPromise;
      expect(output).toContain('state-maintenance-value');
    } finally {
      await session.close();
    }
  }, 15000);

  it('should have essential linux utilities available (verified via file I/O)', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for file content')), 5000);
        session.onData((data) => {
          if (data.includes('utility-check-content')) {
            clearTimeout(timeout);
            resolve(data);
          }
        });
      });

      await session.write('echo "utility-check-content" > util-test.txt\n');
      await session.write('cat util-test.txt\n');
      
      const output = await outputPromise;
      expect(output).toContain('utility-check-content');
    } finally {
      await session.close();
    }
  }, 60000);

  it('should handle complex interactive state (dir change + file creation)', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('verified-file')) {
            resolve(data);
          }
        });
      });

      await session.write('mkdir complex-state-dir\n');
      await session.write('cd complex-state-dir\n');
      await session.write('touch verified-file\n');
      await session.write('ls\n');
      
      const output = await outputPromise;
      expect(output).toContain('verified-file');
    } finally {
      await session.close();
    }
  }, 60000);

});
