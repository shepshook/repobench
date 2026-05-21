import { ISearchEfficiencyTracker, EfficiencyMetrics } from '../contracts';

/**
 * Tracker for search efficiency metrics in agent sessions.
 */
export class SearchEfficiencyTracker implements ISearchEfficiencyTracker {
  private filesAccessed = new Set<string>();
  private filesModified = new Set<string>();
  private timeTakenMs = 0;
  private tokensUsed = 0;

  /**
   * Tracks an access event for a file.
   * @param file The path of the file accessed.
   */
  trackAccess(file: string): void {
    if (file && file.trim() !== '') {
      this.filesAccessed.add(file);
    }
  }

  /**
   * Tracks a modification event for a file.
   * @param file The path of the file modified.
   */
  trackModification(file: string): void {
    if (file && file.trim() !== '') {
      this.filesModified.add(file);
    }
  }

  /**
   * Updates the total time taken for the session.
   * @param ms The time in milliseconds.
   */
  updateTimeTaken(ms: number): void {
    this.timeTakenMs = ms;
  }

  /**
   * Updates the total tokens used for the session.
   * @param count The number of tokens used.
   */
  updateTokensUsed(count: number): void {
    this.tokensUsed = count;
  }

  /**
   * Retrieves the current efficiency metrics.
   * @returns EfficiencyMetrics object.
   */
  getMetrics(): EfficiencyMetrics {
    const filesAccessed = this.filesAccessed.size;
    const filesModified = this.filesModified.size;
    const efficiencyRatio = filesModified === 0 ? 0 : filesAccessed / filesModified;
    return {
      filesAccessed,
      filesModified,
      timeTakenMs: this.timeTakenMs,
      tokensUsed: this.tokensUsed,
      efficiencyRatio,
    };
  }
}
