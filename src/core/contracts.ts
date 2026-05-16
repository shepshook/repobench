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

export const CurationResultSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
  isApproved: z.boolean(),
  rawResponse: z.string().nullable().optional(),
});

export type CurationResult = z.infer<typeof CurationResultSchema>;

export interface ICurationService {
  curate(candidate: Candidate): Promise<CurationResult>;
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
  status: z.enum(['pending', 'validated', 'rejected', 'curated']),
  created_at: z.date(),
  repositoryUrl: z.string().url(),
  repositoryName: z.string(),
  preFixHash: z.string().optional(),
  postFixHash: z.string().optional(),
  curation: CurationResultSchema.nullable().optional(),
});

export type Candidate = z.infer<typeof CandidateSchema>;
// --- Repository Types ---

export interface ICandidateRepository {
  save(candidate: Candidate): void;
  upsert(candidate: Candidate): void;
  exists(hash: string): boolean;
  existsById(id: string): boolean;
  getById(id: string): Candidate | undefined;
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

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  preFixStatus: z.enum(['fail', 'pass', 'error']),
  postFixStatus: z.enum(['fail', 'pass', 'error']),
  preFixOutput: z.string(),
  postFixOutput: z.string(),
  latency: z.number(),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export interface IBenchmarkValidator {
  validate(candidate: Candidate): Promise<ValidationResult>;
}

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

// --- Dataset Export/Import Types ---

export interface IDatasetExporter {
  export(path: string): Promise<number>;
}

export interface IDatasetImporter {
  import(path: string): Promise<number>;
}

export const CandidateExportSchema = z.object({
  repository: z.object({
    url: z.string().url(),
    name: z.string(),
  }),
  preFixHash: z.string().length(40),
  postFixHash: z.string().length(40),
  curation: CurationResultSchema,
  status: z.enum(['pending', 'validated', 'rejected', 'curated']),
  metadata: z.object({
    candidateId: z.string().uuid(),
    createdAt: z.string().datetime(),
  }),
});

export type CandidateExport = z.infer<typeof CandidateExportSchema>;
