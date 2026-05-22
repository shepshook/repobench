import { describe, it, expect } from 'vitest';
import { SearchEfficiencyTracker } from '../../src/core/services/search-efficiency-tracker';

describe('Efficiency Ratio Regression', () => {
    it('should calculate efficiency ratio as Accessed / Modified when accessed is more than modified', () => {
        const tracker = new SearchEfficiencyTracker();
        // Setup: 2 accessed, 1 modified
        tracker.trackAccess('file1.ts');
        tracker.trackAccess('file2.ts');
        tracker.trackModification('file1.ts');
        
        const metrics = tracker.getMetrics();
        
        expect(metrics.filesAccessed).toBe(2);
        expect(metrics.filesModified).toBe(1);
        // This test is expected to fail based on Audit Feedback Round 1
        expect(metrics.efficiencyRatio).toBe(2); 
    });
});
