import { describe, it, expect, beforeEach } from 'vitest';
import { EScoreService } from '../../../src/core/services/e-score-service';
import { IScorer } from '../../../src/core/contracts';

describe('EScoreService Regression', () => {
    let service: IScorer;

    beforeEach(() => {
        service = new EScoreService();
    });

    it('should correctly include success in the E-Score calculation', () => {
        // Based on audit: success should be in numerator
        // formula: eScore = (success / (cost * logLatency)) * efficiencyMultiplier
        // If success = 0.5, cost = 10, latency = 100, mult = 1
        // log(100) = 4.60517
        // eScore = (0.5 / (10 * 4.60517)) * 1 = (0.5 / 46.0517) = 0.010857
        
        const runData = {
            success: 0.5,
            cost: 10,
            latency: 100,
            efficiencyMultiplier: 1
        };
        
        // This test should fail if implementation ignores success (uses 1 instead)
        // If it uses 1, it results in 0.0217...
        expect(service.calculateEScore(runData)).toBeCloseTo(0.010857, 5);
    });
});
