import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { Judge } from '../../src/evaluator/judge';
import { ISandbox } from '../../src/types/contracts';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Judge Regression Suite', () => {
  let mockSandbox: ISandbox;
  let judge: Judge;
  let regDir: string;

  beforeAll(() => {
    regDir = path.join(process.cwd(), 'tests', 'regressions');
    if (!fs.existsSync(regDir)) {
      fs.mkdirSync(regDir, { recursive: true });
    }
  });

  beforeEach(() => {
    mockSandbox = {
      init: vi.fn().mockResolvedValue(undefined),
      setup: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn().mockResolvedValue(true),
      ping: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('success'),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      getWorkingDir: vi.fn().mockReturnValue(os.tmpdir()),
    } as unknown as ISandbox;

    judge = new Judge();
  });

  afterAll(() => {
    if (fs.existsSync(regDir)) {
      fs.rmSync(regDir, { recursive: true, force: true });
    }
  });

  it('should correctly report regressions', async () => {
    // Create dummy regression test files
    const testFile = path.join(regDir, 'test1.sh');
    fs.writeFileSync(testFile, '#!/bin/bash\nexit 0');

    const test2File = path.join(regDir, 'test2.sh');
    fs.writeFileSync(test2File, '#!/bin/bash\nexit 1');

    // Mock execute to fail for the second test
    vi.mocked(mockSandbox.execute)
      .mockResolvedValueOnce('success') // test 1
      .mockRejectedValueOnce(new Error('regression')); // test 2

    const metrics = await judge.runRegressionSuite(mockSandbox);

    expect(metrics.regressions).toContain('test2.sh');
    expect(metrics.success).toBe(false);
  });
});
