import { describe, it, expect, vi } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { BasicSignificanceFilter } from '../../src/core/services/filters/significance-filter';
import simpleGit from 'simple-git';

vi.mock('simple-git');
vi.mock('../../src/infrastructure/sandbox');

describe('PtySession ANSI Normalization Repro', () => {
  it('should correctly normalize simple ANSI color codes', () => {
    const input = '\x1b[32mSuccess\x1b[0m';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('Success');
  });

  it('should correctly handle complex ANSI codes in normalize', () => {
    const input = '\x1b[1;31mError\x1b[0m';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('Error');
  });

  it('should normalize prompts and carriage returns while preserving ANSI codes for behavior projects', async () => {
    const sandbox = {
      config: {
        project: 'behavior-project',
        envVars: {}
      },
      isSimulation: true,
      simulationDir: '/tmp/sim'
    } as any;
    
    const rawData = 'user@host:~/dir$ \r\n\x1b[32mSuccess\x1b[0m\r\n';
    
    const isBehavior = sandbox.config.project?.includes('behavior');
    let output = PtySession.normalize(rawData, isBehavior);
    if (isBehavior) {
      output = output.replace(/\x1b/g, '\\x1b');
    }
    
    expect(output).toBe('user@host:~/dir$ \n\\x1b[32mSuccess\\x1b[0m');
  });
});

describe('BasicSignificanceFilter TypeError Repro', () => {
  it('should not throw TypeError for malformed diff lines', async () => {
    const filter = new BasicSignificanceFilter();
    const mockGit = {
      diff: vi.fn().mockResolvedValue('diff --git a/file b/file\n@@ -1,1 +1,1 @@\n+test\n'),
    };
    
    await expect(filter.isSignificant(mockGit as any, 'hash', ['file'])).resolves.not.toThrow();
  });

  it('should not throw TypeError for extremely malformed hunk headers', async () => {
    const filter = new BasicSignificanceFilter();
    const mockGit = {
      diff: vi.fn().mockResolvedValue('diff --git a/file b/file\n@@ -1 +1 @@\n+test\n'),
    };
    
    await expect(filter.isSignificant(mockGit as any, 'hash', ['file'])).resolves.not.toThrow();
  });

  it('should not throw TypeError for completely random lines that look like hunks', async () => {
    const filter = new BasicSignificanceFilter();
    const mockGit = {
      diff: vi.fn().mockResolvedValue('diff --git a/file b/file\n@@ something something @@\n+test\n'),
    };
    
    await expect(filter.isSignificant(mockGit as any, 'hash', ['file'])).resolves.not.toThrow();
  });
});
