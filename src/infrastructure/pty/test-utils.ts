import { IPtySession } from '../../core/contracts';

/**
 * Polls the PTY session's screen state until the expected text is found or the timeout is reached.
 * Useful for eliminating fragile timeouts in infrastructure tests.
 */
export async function waitForText(
  session: IPtySession,
  text: string,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (session.getScreenState().includes(text)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout: Expected text "${text}" not found in screen state within ${timeout}ms\n\nCurrent screen state:\n${session.getScreenState()}`);
}
