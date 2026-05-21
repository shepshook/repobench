import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEfficiencyTracker } from '../../src/core/services/search-efficiency-tracker';

describe('SearchEfficiencyTracker', () => {
  let tracker: SearchEfficiencyTracker;

  beforeEach(() => {
    tracker = new SearchEfficiencyTracker();
  });

  it('should correctly track and count accessed files', () => {
    tracker.trackAccess('src/main.ts');
    tracker.trackModification('src/main.ts');
    const metrics = tracker.getMetrics();
    
    expect(metrics.filesAccessed).toBe(1);
    expect(metrics.filesModified).toBe(1);
    expect(metrics.efficiencyRatio).toBe(1);
  });

  it('should handle multiple accesses to the same file correctly', () => {
    tracker.trackAccess('src/main.ts');
    tracker.trackAccess('src/main.ts');
    
    const metrics = tracker.getMetrics();
    expect(metrics.filesAccessed).toBe(1); // Should be unique files
  });

  it('should handle multiple modifications to the same file correctly', () => {
    tracker.trackModification('src/main.ts');
    tracker.trackModification('src/main.ts');
    
    const metrics = tracker.getMetrics();
    expect(metrics.filesModified).toBe(1); // Should be unique files
  });

  it('should calculate ratio correctly when no modifications exist', () => {
    tracker.trackAccess('src/main.ts');
    
    const metrics = tracker.getMetrics();
    expect(metrics.filesModified).toBe(0);
    expect(metrics.efficiencyRatio).toBe(0); // Assuming 0 if no mods
  });

});
