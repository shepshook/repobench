import { describe, it, expect } from 'vitest';
import { createFailingDockerFixture } from '../infrastructure/fixtures';

describe('Sandbox Docker Fallback', () => {
  it('should fallback to simulation mode when Docker is unavailable (ENOENT)', async () => {
    const { sandbox } = createFailingDockerFixture('container', {
      project: 'fallback-test',
    });

    await sandbox.init();

    const result = await sandbox.execute('echo "Hello Sandbox"');
    expect(result.stdout).toContain('Hello Sandbox');
  }, 15000);});
