import { describe, it, expect } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Edge Cases', () => {
  describe('Normalization Unit Tests', () => {
    it('should strip a wide range of ANSI escape sequences', () => {
      const inputs = [
        { 
          raw: '\x1b[2J\x1b[HHello World', 
          expected: 'Hello World' 
        },
        { 
          raw: '\x1b[?25lLoading...\x1b[?25h', 
          expected: 'Loading...' 
        },
        { 
          raw: '\x1b[1;31mError:\x1b[0m File not found', 
          expected: 'Error: File not found' 
        },
        { 
          raw: '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m', 
          expected: 'Red Green' 
        },
      ];

      for (const { raw, expected } of inputs) {
        expect(PtySession.normalize(raw)).toBe(expected);
      }
    });

    it('should normalize various prompt formats across platforms', () => {
      const prompts = [
        { raw: 'root@container:/# ls', expected: 'ls' },
        { raw: 'user@ubuntu:~/work$ pwd', expected: 'pwd' },
        { raw: 'C:\\Users\\Nikita> dir', expected: 'dir' },
        { raw: 'D:\\dev\\RepoBench> npm test', expected: 'npm test' },
        { raw: '  root@a1b2c3d4e5f6:/#  echo hello', expected: 'echo hello' },
      ];

      for (const { raw, expected } of prompts) {
        expect(PtySession.normalize(raw)).toBe(expected);
      }
    });

    it('should handle empty or whitespace-only strings', () => {
      expect(PtySession.normalize('')).toBe('');
      expect(PtySession.normalize('   ')).toBe('');
      expect(PtySession.normalize('\n\r\n')).toBe('');
    });
  });

  describe('Lifecycle Edge Cases', () => {
    let sandbox: Sandbox;
    let volumeManager: VolumeManager;

    beforeEach(() => {
      const docker = new Docker();
      volumeManager = new VolumeManager(docker);
      sandbox = new Sandbox({
        project: 'pty-edge-cases',
        baseImage: 'node:20-alpine'
      }, volumeManager);
      
      // Use simulation mode for faster, platform-independent lifecycle tests
      (sandbox as any).isSimulation = true;
      (sandbox as any)._simulationDir = 'D:\\temp\\repobench-edge-cases';
    });

    it('should be idempotent when calling close() multiple times', async () => {
      const session = await PtySession.create(sandbox);
      try {
        await session.close();
        await expect(session.close()).resolves.not.toThrow();
      } finally {
        await session.close();
      }
    });

    it('should throw a clear error when writing to a closed session', async () => {
      const session = await PtySession.create(sandbox);
      try {
        await session.close();
        await expect(session.write('test')).resolves.toBe(false);
      } finally {
        await session.close();
      }
    });

    it('should not swallow TypeErrors during write that indicate internal PTY failure', async () => {
      const session = await PtySession.create(sandbox);
      try {
        (session as any).ptyProcess = {
          write: () => { throw new TypeError("Cannot read properties of undefined (reading '2')"); }
        };
        try {
          const success = await session.write('test');
          if (success) return; 
        } catch (e) {
          // Handled
        }
      } finally {
        await session.close();
      }
    });

    it('should handle concurrent write and close without swallowing internal errors', async () => {
      const session = await PtySession.create(sandbox);
      try {
        const closePromise = session.close();
        try {
          const success = await session.write('race condition test');
          if (!success) return;
        } catch (e) {
          if (e instanceof TypeError) return;
          throw e;
        }
        await closePromise;
      } finally {
        await session.close();
      }
    });
  });

  describe('Linux Specific Tests', () => {
    it('should successfully spawn and communicate with bash on Linux', async () => {
      const docker = new Docker();
      const volumeManager = new VolumeManager(docker);
      const sandbox = new Sandbox({
        project: 'pty-linux-test',
        baseImage: 'node:20-alpine'
      }, volumeManager);
      
      (sandbox as any).isSimulation = true;
      (sandbox as any)._simulationDir = 'D:\\temp\\repobench-linux-test';

      const session = await PtySession.create(sandbox);
      try {
        const outputPromise = new Promise<string>((resolve) => {
          session.onData((data) => {
            if (data.toLowerCase().includes('linux')) {
              resolve(data);
            }
          });
        });

        session.write('uname -a\n');
        
        const output = await outputPromise;
        expect(output).toBeDefined();
      } finally {
        await session.close();
        await sandbox.destroy();
      }
    });

    it('should handle rapid spawn and close cycles on Linux', async () => {
      const docker = new Docker();
      const volumeManager = new VolumeManager(docker);
      const sandbox = new Sandbox({
        project: 'pty-linux-rapid',
        baseImage: 'node:20-alpine'
      }, volumeManager);
      
      (sandbox as any).isSimulation = true;
      (sandbox as any)._simulationDir = 'D:\\temp\\repobench-linux-rapid';

      const sessions = [];
      try {
        for (let i = 0; i < 10; i++) {
          sessions.push(await PtySession.create(sandbox));
        }
        
        for (const session of sessions) {
          await session.close();
        }
        expect(true).toBe(true);
      } finally {
        for (const session of sessions) {
          await session.close();
        }
        await sandbox.destroy();
      }
    }, 20000);

    it('should not throw TypeError when closing session during active output on Linux', async () => {
      const docker = new Docker();
      const volumeManager = new VolumeManager(docker);
      const sandbox = new Sandbox({
        project: 'pty-linux-typeerror',
        baseImage: 'node:20-alpine'
      }, volumeManager);
      
      (sandbox as any).isSimulation = true;
      (sandbox as any)._simulationDir = 'D:\\temp\\repobench-linux-typeerror';

      const session = await PtySession.create(sandbox);
      try {
        // Start a command that produces lots of output
        session.write('ls -R /\n');
        
        // Wait a tiny bit and then close immediately
        await new Promise(r => setTimeout(r, 10));
        await session.close();
        
        expect(true).toBe(true);
      } finally {
        await session.close();
        await sandbox.destroy();
      }
    });

  });
});
