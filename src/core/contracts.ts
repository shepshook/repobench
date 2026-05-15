import { z } from 'zod';
import { RepoBenchConfig } from './config';

/**
 * RepoBench Core Contracts
 * This file defines the shared interfaces and types used across the system.
 */

// --- Miner Types ---
 
export interface IMiner {
  mineCommits(config: RepoBenchConfig): Promise<Candidate[]>;
}

import { SimpleGit } from 'simple-git';

export interface ISignificanceFilter {
  isSignificant(git: SimpleGit, hash: string, files: string[]): Promise<boolean>;
}

 
export const CandidateSchema = z.object({

  id: z.string().uuid(),
  hash: z.string(), // Git commit hash
  message: z.string(),
  files: z.array(z.string()), // Affected files
  status: z.enum(['pending', 'validated', 'rejected']),
  created_at: z.date(),
});

export type Candidate = z.infer<typeof CandidateSchema>;
// --- Repository Types ---

export interface ICandidateRepository {
  save(candidate: Candidate): void;
  exists(hash: string): boolean;
  getAll(): Candidate[];
}

// --- Sandbox Types ---

export interface SandboxConfig {
  buildCommand: string;
  testCommand: string;
  envVars: Record<string, string>;
  baseImage?: string;
  baseImagePath?: string;
}

export interface ISandbox {
  readonly id: string;
  init(): Promise<void>;
  destroy(): Promise<void>;
  execute(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  switchState(hash: string): Promise<void>;
  getFilesystemSnapshot(): Promise<string[]>;
  ping(): Promise<boolean>;
}

// --- Session Types ---

export const AgentConfigSchema = z.object({
  agentId: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  systemPrompt: z.string(),
  cliArgs: z.array(z.string()),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export interface SessionTranscript {
  lines: Array<{
    timestamp: Date;
    source: 'agent' | 'sandbox' | 'system';
    text: string;
  }>;
}

export interface SessionResult {
  success: boolean;
  cost: number;
  latency: number; // ms
  eScore: number;
  efficiency: number; // FilesAccessed / FilesModified
  logPath: string;
}

// --- Judge Types ---

export interface EvalMetrics {
  regressions: string[]; // List of tests that started passing and then failed
  fixes: string[]; // List of tests that started failing and then passed
  totalTests: number;
  binarySuccess: boolean; // Pre-Fail && Post-Pass
}

export interface SemanticScore {
  correctness: number; // 1-5
  maintainability: number; // 1-5
  idiomaticity: number; // 1-5
  reasoning: string;
}

// --- Leaderboard Types ---

export const RunResultSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  candidateId: z.string().uuid(),
  metrics: z.object({
    success: z.boolean(),
    cost: z.number(),
    latency: z.number(),
    eScore: z.number(),
  }),
  timestamp: z.date(),
  logPath: z.string(),
});

export type RunResult = z.infer<typeof RunResultSchema>;
