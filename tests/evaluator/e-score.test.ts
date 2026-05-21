import { describe, it, expect, beforeEach } from 'vitest';
import { EScoreService } from '../../src/core/services/e-score-service';
import { IScorer } from '../../src/core/contracts';

describe('EScoreService (Evaluator Domain)', () => {
    let service: IScorer;

    beforeEach(() => {
        service = new EScoreService();
    });

    it('should return 0 when success is 0', () => {
        const runData = { success: 0, cost: 10, latency: 100, efficiencyMultiplier: 1 };
        expect(service.calculateEScore(runData)).toBe(0);
    });

    it('should handle high latency and high cost correctly', () => {
        const runData = { success: 1, cost: 1000000, latency: 1000000, efficiencyMultiplier: 1 };
        // E-Score = 1 / (1000000 * Math.log(1000000)) = 1 / (1000000 * 13.815510557964274)
        // E-Score = 1 / 13815510.557964274 = 0.0000000723825
        expect(service.calculateEScore(runData)).toBeCloseTo(0.0000000723825, 12);
    });

    it('should handle success flag correctly with multiplier', () => {
        const runData = { success: 1, cost: 10, latency: 100, efficiencyMultiplier: 2 };
        // Base E-Score = 0.0217147
        // Expected = 0.0217147 * 2 = 0.0434294
        expect(service.calculateEScore(runData)).toBeCloseTo(0.0434294, 7);
    });

    it('should handle extremely small latency (just above 1) without overflow', () => {
        const runData = { success: 1, cost: 10, latency: 1.000000000000001, efficiencyMultiplier: 1 };
        // This might result in a very large number, but it shouldn't be NaN or Infinity.
        const score = service.calculateEScore(runData);
        expect(score).not.toBeNaN();
        expect(score).not.toBe(Infinity);
        expect(score).toBeGreaterThan(0);
    });
});
