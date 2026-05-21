import { describe, it, expect } from 'vitest';
import { SearchEfficiencyTracker } from '../../src/core/services/search-efficiency-tracker';

describe('SearchEfficiencyTracker Coverage', () => {
    it('should ignore duplicate file modification', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackModification('file1.ts');
        tracker.trackModification('file1.ts');
        expect(tracker.getMetrics().filesModified).toBe(1);
    });

    it('should count file as accessed and modified independently', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackAccess('file1.ts');
        tracker.trackModification('file1.ts');
        const metrics = tracker.getMetrics();
        expect(metrics.filesAccessed).toBe(1);
        expect(metrics.filesModified).toBe(1);
        expect(metrics.efficiencyRatio).toBe(1);
    });

    it('should calculate efficiency ratio correctly when modified is zero', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackAccess('file1.ts');
        tracker.trackAccess('file2.ts');
        const metrics = tracker.getMetrics();
        expect(metrics.filesAccessed).toBe(2);
        expect(metrics.filesModified).toBe(0);
        expect(metrics.efficiencyRatio).toBe(0);
    });

    it('should calculate efficiency ratio correctly when accessed is more than modified', () => {
        const tracker = new SearchEfficiencyTracker();
        tracker.trackAccess('file1.ts');
        tracker.trackAccess('file2.ts');
        tracker.trackModification('file1.ts');
        const metrics = tracker.getMetrics();
        expect(metrics.filesAccessed).toBe(2);
        expect(metrics.filesModified).toBe(1);
        expect(metrics.efficiencyRatio).toBe(2);
    });
});
