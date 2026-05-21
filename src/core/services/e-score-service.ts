
import { IScorer } from '../contracts';

export class EScoreService implements IScorer {
    calculateEScore(data: {
        success: number;
        cost: number;
        latency: number;
        efficiencyMultiplier: number;
    }): number {
        const { cost, latency, efficiencyMultiplier } = data;

        // Edge case checks
        if (cost === 0 || latency <= 1) {
            return 0;
        }

        const logLatency = Math.log(latency);
        
        // Ensure we don't divide by zero
        if (logLatency === 0) {
            return 0;
        }

        const eScore = (data.success / (cost * logLatency)) * (efficiencyMultiplier || 1);

        // Return sane default if NaN or Infinity
        if (isNaN(eScore) || !isFinite(eScore)) {
            return 0;
        }

        return eScore;
    }
}
