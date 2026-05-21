import { describe, it, expect } from 'vitest';
import { createSandboxFixture } from './fixtures';

describe('Sandbox File Interception Mechanism Fragility', () => {
  // These tests are expected to fail according to the design spec:
  // "Pattern matching is fragile — wildcards, pipes, and compound commands may produce false negatives."

  it('should track files modified in compound commands (e.g., &&)', async () => {
    const { sandbox } = createSandboxFixture();
    const tracker = sandbox.getFileAccessTracker();
    
    // This command is expected to fail interception
    await sandbox.runCommand('touch compound.txt && echo "hi" > compound.txt');
    
    const modifiedFiles = tracker.getModifiedFiles();
    expect(modifiedFiles).toContain('compound.txt');
  });

  it('should track files accessed in pipelines (e.g., |)', async () => {
    const { sandbox } = createSandboxFixture();
    const tracker = sandbox.getFileAccessTracker();
    
    await sandbox.runCommand('echo "data" > pipe_test.txt');
    // This command is expected to fail interception
    await sandbox.runCommand('cat pipe_test.txt | grep "data"');
    
    const accessedFiles = tracker.getAccessedFiles();
    expect(accessedFiles).toContain('pipe_test.txt');
  });
});
