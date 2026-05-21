import { describe, it, expect } from 'vitest';
import { SearchEfficiencyTracker } from '../../src/core/services/search-efficiency-tracker';

describe('SearchEfficiencyTracker Robustness', () => {
    it('should ignore duplicate file access', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackAccess('file1.ts');
        tracker.trackAccess('file1.ts');
        expect(tracker.getMetrics().filesAccessed).toBe(1);
    });

    it('should ignore empty string file access', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackAccess('');
        expect(tracker.getMetrics().filesAccessed).toBe(0);
    });

    it('should track timeTakenMs and tokensUsed in metrics', () => {
        const tracker = new SearchEfficiencyTracker();
        const metrics = tracker.getMetrics();
        // This test verifies that these fields exist in the metrics, even if they aren't updatable yet.
        expect(metrics).toHaveProperty('timeTakenMs');
        expect(metrics).toHaveProperty('tokensUsed');
    });
});
