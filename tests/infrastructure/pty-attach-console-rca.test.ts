import { describe, it, expect } from 'vitest';
import { mapSpawnErrorToRca } from '../../src/infrastructure/pty/rca-utils';

describe('PtySession AttachConsole RCA', () => {
  it('should provide a descriptive RCA error when spawn fails due to privileges', () => {
    const attachConsoleError = new Error('AttachConsole failed: Access is denied');
    const rca = mapSpawnErrorToRca(attachConsoleError);
    
    expect(rca).not.toBe(attachConsoleError.message);
    expect(rca).toContain('Windows privilege requirements');
    expect(rca).toContain('administrator');
  });

  it('should provide a descriptive RCA error when spawn fails due to environment', () => {
    const attachConsoleError = new Error('AttachConsole failed: Invalid handle');
    const rca = mapSpawnErrorToRca(attachConsoleError);
    
    expect(rca).not.toBe(attachConsoleError.message);
    expect(rca).toContain('environmental configurations');
  });

  it('should provide a descriptive error for node-pty dependency limitations', () => {
    const nodePtyError = new Error('node-pty: Internal Windows error');
    const rca = mapSpawnErrorToRca(nodePtyError);
    
    expect(rca).not.toBe(nodePtyError.message);
    expect(rca).toContain('node-pty dependency limitations');
  });
});
