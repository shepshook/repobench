import { describe, it, expect } from 'vitest';
import { ICurationService, CurationResult } from '../../../src/core/contracts';

describe('CurationService Contract', () => {
  it('should have the expected CurationResult structure', () => {
    const result: CurationResult = {
      score: 0.9,
      reasoning: 'Good code',
      isApproved: true
    };
    expect(result.score).toBe(0.9);
    expect(result.reasoning).toBe('Good code');
    expect(result.isApproved).toBe(true);
  });

  it('should define an ICurationService', () => {
    // This is just to test the interface definition, not the implementation
    const service: ICurationService = {
      curate: (candidate: any) => Promise.resolve({ score: 1, reasoning: 'test', isApproved: true })
    };
    expect(service).toBeDefined();
  });
});
