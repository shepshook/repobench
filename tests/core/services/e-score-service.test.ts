import { describe, it, expect, beforeEach } from 'vitest';
import { EScoreService } from '../../../src/core/services/e-score-service';
import { IScorer } from '../../../src/core/contracts';

describe('EScoreService', () => {
    let service: IScorer;

    beforeEach(() => {
        service = new EScoreService();
    });

    it('should calculate E-Score correctly for normal inputs', () => {
        const runData = {
            success: 1,
            cost: 10,
            latency: 100,
            efficiencyMultiplier: 1
        };
        // E-Score = 1 / (10 * Math.log(100)) * 1 = 1 / (10 * 4.605) = 1 / 46.05 = 0.0217
        expect(service.calculateEScore(runData)).toBeCloseTo(0.0217, 4);
    });

    it('should handle Cost = 0 to avoid division by zero', () => {
        const runData = {
            success: 1,
            cost: 0,
            latency: 100,
            efficiencyMultiplier: 1
        };
        // Should return 0 as a sane default
        expect(service.calculateEScore(runData)).toBe(0);
    });

    it('should handle Latency = 1 to avoid log(1) = 0 division by zero', () => {
        const runData = {
            success: 1,
            cost: 10,
            latency: 1,
            efficiencyMultiplier: 1
        };
        // Should return 0 as a sane default
        expect(service.calculateEScore(runData)).toBe(0);
    });
    
    it('should return 0 when Latency < 1', () => {
        const runData = {
            success: 1,
            cost: 10,
            latency: 0.5,
            efficiencyMultiplier: 1
        };
        // Should return 0 as a sane default
        expect(service.calculateEScore(runData)).toBe(0);
    });
});
