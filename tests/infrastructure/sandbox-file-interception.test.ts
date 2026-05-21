import { describe, it, expect } from 'vitest';
import { createSandboxFixture } from './fixtures';

describe('Sandbox File Interception Mechanism', () => {
  it('should provide an interface to track file access', async () => {
    const { sandbox } = createSandboxFixture();
    
    expect(sandbox.getFileAccessTracker).toBeDefined();
    
    const tracker = sandbox.getFileAccessTracker();
    expect(tracker).toBeDefined();
  });

  it('should track file modifications', async () => {
    const { sandbox } = createSandboxFixture();
    
    const tracker = sandbox.getFileAccessTracker();
    
    await sandbox.runCommand('touch test.txt');
    
    const modifiedFiles = tracker.getModifiedFiles();
    expect(modifiedFiles).toContain('test.txt');
  });

  it('should track file reads', async () => {
    const { sandbox } = createSandboxFixture();
    
    const tracker = sandbox.getFileAccessTracker();
    
    await sandbox.runCommand('echo "hello" > read_test.txt');
    await sandbox.runCommand('cat read_test.txt');
    
    const accessedFiles = tracker.getAccessedFiles();
    expect(accessedFiles).toContain('read_test.txt');
  });

  it('should track file deletions', async () => {
    const { sandbox } = createSandboxFixture();
    
    const tracker = sandbox.getFileAccessTracker();
    
    await sandbox.runCommand('touch delete_test.txt');
    await sandbox.runCommand('rm delete_test.txt');
    
    const deletedFiles = tracker.getDeletedFiles();
    expect(deletedFiles).toContain('delete_test.txt');
  });
});
