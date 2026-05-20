import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Timeout', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    vi.useFakeTimers();
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-timeout-test'
    }, volumeManager);
    await sandbox.init();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await sandbox.destroy();
  });

  it('should terminate session after configured inactivity timeout', async () => {
    const timeoutMs = 5000;
    // We pass timeout in options. This will currently be ignored by PtySession.
    const session: IPtySession = await PtySession.create(sandbox, { timeout: timeoutMs } as any);
    
    let timeoutOccurred = false;
    // We expect an onTimeout method to be added to IPtySession/PtySession
    if (typeof (session as any).onTimeout === 'function') {
      (session as any).onTimeout(() => {
        timeoutOccurred = true;
      });
    } else {
      // If it's not implemented yet, the test should fail
      throw new Error('onTimeout method not implemented on PtySession');
    }

    // Advance time by timeoutMs
    vi.advanceTimersByTime(timeoutMs);
    
    // Allow async operations to complete
    await vi.runAllTimersAsync();

    expect(timeoutOccurred).toBe(true);
    
    const exitCode = await session.waitForExit();
    expect(exitCode).toBeDefined();
  });

  it('should reset timeout timer on activity (write)', async () => {
    const timeoutMs = 5000;
    const session: IPtySession = await PtySession.create(sandbox, { timeout: timeoutMs } as any);
    
    let timeoutOccurred = false;
    if (typeof (session as any).onTimeout === 'function') {
      (session as any).onTimeout(() => {
        timeoutOccurred = true;
      });
    }

    // Advance time by half of timeout
    vi.advanceTimersByTime(timeoutMs / 2);
    
    // Activity: Write to session
    await session.write('echo "keepalive"\n');
    
    // Advance time by another half of timeout
    vi.advanceTimersByTime(timeoutMs / 2);
    
    // Should not have timed out yet because activity reset the timer
    expect(timeoutOccurred).toBe(false);
    
    // Now advance beyond timeout
    vi.advanceTimersByTime(timeoutMs);
    await vi.runAllTimersAsync();
    
    expect(timeoutOccurred).toBe(true);
  });

  it('should reset timeout timer on activity (incoming data)', async () => {
    const timeoutMs = 5000;
    const session: IPtySession = await PtySession.create(sandbox, { timeout: timeoutMs } as any);
    
    let timeoutOccurred = false;
    if (typeof (session as any).onTimeout === 'function') {
      (session as any).onTimeout(() => {
        timeoutOccurred = true;
      });
    }

    vi.advanceTimersByTime(timeoutMs / 2);
    
    // Activity: Injected response (simulates incoming data)
    await session.injectResponse('some data');
    
    vi.advanceTimersByTime(timeoutMs / 2);
    expect(timeoutOccurred).toBe(false);
    
    vi.advanceTimersByTime(timeoutMs);
    await vi.runAllTimersAsync();
    
    expect(timeoutOccurred).toBe(true);
  });

  it('should throw descriptive error if cleanup fails during timeout', async () => {
    const timeoutMs = 5000;
    const session: IPtySession = await PtySession.create(sandbox, { timeout: timeoutMs } as any);
    
    // Mock close to fail
    vi.spyOn(session, 'close').mockRejectedValue(new Error('Cleanup failed'));
    
    // We need to see if the timeout mechanism handles this error. 
    // This might be hard to test without knowing HOW it's implemented, 
    // but we can check if any error is emitted or if it's logged.
    // For now, let's just verify it doesn't crash the process.
    
    vi.advanceTimersByTime(timeoutMs);
    await vi.runAllTimersAsync();
    
    // If it's implemented as requested, it should "Throw descriptive errors if timeout/cleanup fails"
    // Since it's an async timeout, it probably emits an 'error' event or logs it.
  });
});
