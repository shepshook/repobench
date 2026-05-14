import { describe, it, expect } from 'vitest';
import { Judge } from '../../../src/core/judge/judge';
import { ISandbox } from '../../src/types/contracts';

describe('Judge E-Score', () => {
  const mockSandbox: ISandbox = {
    init: () => Promise.resolve(),
    setup: () => Promise.resolve(),
    verify: () => Promise.resolve(true),
    ping: () => Promise.resolve(true),
    execute: () => Promise.resolve(''),
    switchToState: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
    getWorkingDir: () => '/tmp',
  };
  const judge = new Judge(mockSandbox);

  it('should return 0 if success is false', () => {
    const metrics = { success: false, cost: 0.01, latency: 100, searchEfficiency: 1 };
    expect(judge.calculateScore(metrics)).toBe(0);
  });

  it('should calculate E-Score correctly for a successful fix', () => {
    const metrics = { success: true, cost: 0.01, latency: 100, searchEfficiency: 1 };
    // Score = (1 / (0.01 * log(100))) * (1/1)
    // log(100) is natural log in JS (Math.log) approx 4.605
    const expected = 1 / (0.01 * Math.log(100)) * 1;
    expect(judge.calculateScore(metrics)).toBeCloseTo(expected, 5);
  });

  it('should handle zero cost by using epsilon', () => {
    const metrics = { success: true, cost: 0, latency: 100, searchEfficiency: 1 };
    const expected = 1 / (0.000001 * Math.log(100)) * 1;
    expect(judge.calculateScore(metrics)).toBeCloseTo(expected, 5);
  });

  it('should handle low latency by using minimum latency', () => {
    const metrics = { success: true, cost: 0.01, latency: 0, searchEfficiency: 1 };
    const expected = 1 / (0.01 * Math.log(2)) * 1;
    expect(judge.calculateScore(metrics)).toBeCloseTo(expected, 5);
  });

  it('should apply efficiency multiplier', () => {
    const metrics = { success: true, cost: 0.01, latency: 100, searchEfficiency: 5 };
    const expected = (1 / (0.01 * Math.log(100))) * (1 / 5);
    expect(judge.calculateScore(metrics)).toBeCloseTo(expected, 5);
  });
});
