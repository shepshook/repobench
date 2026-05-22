import { z } from 'zod';
import { RepoBenchConfig } from './config';
import { SANDBOX_APP_LABEL } from './constants';
import { CostMetricsSchema } from './entities/cost-metrics';
import type { CostMetrics } from './entities/cost-metrics';
import { EfficiencyMetricsSchema } from './entities/search-efficiency';
import type { EfficiencyMetrics } from './entities/search-efficiency';
import { SemanticScoreSchema } from './entities/evaluation-results';
import type { SemanticScore } from './entities/evaluation-results';

export { SANDBOX_APP_LABEL, CostMetricsSchema, CostMetrics, EfficiencyMetricsSchema, EfficiencyMetrics, SemanticScoreSchema, SemanticScore };

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

export interface ISandboxManager {
  cleanupOrphanedContainers(): Promise<void>;
  trackContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  killTimedOutContainers(timeoutMs: number): Promise<void>;
  createCacheForSession(sessionId: string, lockId: string): Promise<void>;
  setCacheLimit(limit: number): Promise<void>;
  pruneCache(): Promise<void>;
  listCacheVolumes(): Promise<string[]>;
  teardown(): Promise<void>;
  getCacheStatus(): Promise<{ pruned: boolean }>;
}

export const ContainerRepositorySchema = z.object({
  containerId: z.string(),
  image: z.string(),
  createdAt: z.string().datetime(),
  status: z.string(),
  labels: z.object({
    app: z.literal(SANDBOX_APP_LABEL),
  }),
});

export type ContainerMetadata = z.infer<typeof ContainerRepositorySchema>;

export interface SandboxConfig {
  buildCommand?: string;
  testCommand?: string;
  envVars?: Record<string, string>;
  baseImage?: string;
  baseImagePath?: string;
  cacheVolumes?: { hostPath: string; containerPath: string }[];
  cachePaths?: string[];
  project?: string;
}

export interface IDockerVolume {
  remove(): Promise<void>;
}

export interface IDocker {
  createVolume(options: { Name: string; Labels?: Record<string, string> }): Promise<IDockerVolume>;
  getVolume(name: string): IDockerVolume;
  getImage(image: string): IDockerImage;
  pull(image: string): Promise<void>;
  createContainer(options: unknown): Promise<IDockerContainer>;
}

export interface IDockerImage {
  remove(options?: { force?: boolean }): Promise<void>;
  inspect(): Promise<{ [key: string]: unknown }>;
}

export interface IDockerContainer {
  readonly id: string;
  start(): Promise<void>;
  stop(options?: { t?: number }): Promise<void>;
  remove(options?: { force?: boolean; v?: boolean }): Promise<void>;
  inspect(): Promise<IDockerContainerInspect>;
  exec(options: IDockerExecOptions): Promise<IDockerExec>;
}

export interface IDockerExecOptions {
  Cmd: string[];
  Tty?: boolean;
  AttachStdin?: boolean;
  AttachStdout?: boolean;
  AttachStderr?: boolean;
  User?: string;
  Env?: string[];
  WorkingDir?: string;
}

export interface IDockerExec {
  start(options?: { hijack?: boolean; stdin?: boolean }): Promise<IDockerStream>;
  inspect(): Promise<{
    ID: string;
    Running: boolean;
    ExitCode: number;
    ProcessConfig: { arguments: string[]; entrypoint: string };
  }>;
}

export interface IDockerStream {
  on(event: 'data', callback: (data: Buffer) => void): void;
  on(event: 'end', callback: () => void): void;
  on(event: 'error', callback: (err: Error) => void): void;
  on(event: 'exit', callback: (code: number) => void): void;
  write(data: Buffer): void;
  destroy(): void;
}

export interface IDockerContainerInspect {
  Id: string;
  Config: {
    Image: string;
    Labels?: Record<string, string>;
    Cmd?: string[];
    Env?: string[];
    WorkingDir?: string;
    User?: string;
  };
  State: {
    Status: string;
    ExitCode: number;
    Running: boolean;
  };
  Created: string;
  Name: string;
}

export interface IVolumeManager {
  calculateCacheKey(lockFile?: string): Promise<string>;
  setupCacheVolumes(cacheVolumes: { hostPath: string; containerPath: string }[], project: string, lockFile?: string, isSimulation?: boolean): Promise<boolean>;
  recordCacheStatus(project: string, lockFile?: string, isSimulation?: boolean): Promise<{ hit: boolean }>;
  getVolumes(): Record<string, string>;
  createVolume(name: string): Promise<boolean>;
  mountVolume(name: string, path: string): Promise<void>;
  removeVolume(name: string): Promise<void>;
  resetStats(): void;
  getDocker(): IDocker;
  getCacheStats(): Promise<{ hits: number; misses: number }>;
  resetStats(): void;
  readonly simCacheRoot: string;
}

export interface IFileAccessTracker {
  getModifiedFiles(): string[];
  getAccessedFiles(): string[];
  getDeletedFiles(): string[];
}

/**
 * Tracks file access and modification metrics for search efficiency.
 *
 * Definitions:
 * - Files Accessed: The set of unique file paths that the agent read from the filesystem during the session.
 * - Files Modified: The set of unique file paths that the agent wrote to or modified on the filesystem during the session.
 */
export interface ISearchEfficiencyTracker {
  trackAccess(file: string): void;
  trackModification(file: string): void;
  updateTimeTaken(ms: number): void;
  updateTokensUsed(count: number): void;
  getMetrics(): EfficiencyMetrics;
}

export interface ISandbox {
  readonly id: string;
  readonly config: SandboxConfig;
  init(): Promise<void>;
  destroy(): Promise<void>;
  execute(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  runCommand(command: string, options?: { timeout?: number; env?: Record<string, string> }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  switchState(hash: string): Promise<void>;
  createSnapshot(): Promise<void>;
  restoreSnapshot(): Promise<void>;
  getFilesystemSnapshot(): Promise<string[]>;
  getCacheStats(): Promise<{ hits: number; misses: number }>;
  ping(): Promise<boolean>;
  getFileAccessTracker(): IFileAccessTracker;
}

export interface ISessionRepository {
  saveCost(runId: string, metrics: CostMetrics): Promise<void>;
}

export interface ISessionOrchestrator {
  createSession(config: AgentConfig, sandbox: ISandbox): Promise<IPtySession>;
  executeSession(config: AgentConfig, sandbox: ISandbox, buildCommand: string, runId?: string): Promise<{ success: boolean, cost: number }>;
}

import type { IAgentAdapter } from './contracts/agent-adapter';
// --- Session Types ---

export { IAgentAdapter };

export const InteractionRuleSchema = z.object({
  pattern: z.string(),
  response: z.string(),
});

export type InteractionRule = z.infer<typeof InteractionRuleSchema>;

export const CompletionSignatureSchema = z.object({
  pattern: z.string(),
  name: z.string(),
});

export type CompletionSignature = z.infer<typeof CompletionSignatureSchema>;

export interface IDoneDetector {
  isDone(output: string): boolean;
  setSignatures(signatures: CompletionSignature[]): void;
}

export interface IPromptHandler {

  handle(data: string): string | null;
  setRules(rules: InteractionRule[]): void;
}

export interface IPtySession {
  onData(callback: (data: string) => void): void;
  onTimeout(callback: () => void): void;
  write(data: string): Promise<boolean>;
  injectResponse(data: string): Promise<void>;
  close(): Promise<void>;
  getScreenState(): string;
  waitForExit(): Promise<number>;
}

export const AgentConfigSchema = z.object({
  agentId: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2),
  systemPrompt: z.string(),
  max_tokens: z.number().optional(),
  cliArgs: z.array(z.string()),
  completionSignatures: z.array(CompletionSignatureSchema).optional(),
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

export interface IScorer {
  calculateEScore(data: {
    success: number;
    cost: number;
    latency: number;
    efficiencyMultiplier: number;
  }): number;
}

export type EScoreFormula = (data: {
  success: number;
  cost: number;
  latency: number;
  efficiencyMultiplier: number;
}) => number;


export interface TestResults {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  passed: boolean;
}

export interface ComparisonResult {
  status: 'improved' | 'regressed' | 'unchanged' | 'error';
  diff: string;
  summary: string;
}

export interface IRegressionTestRunner {
  runTests(sandbox: ISandbox, command: string): Promise<TestResults>;
  compareResults(pre: TestResults, post: TestResults): ComparisonResult;
}

export interface ICostParser {
  parse(logs: string): CostMetrics;
}

export const CostParsingRuleSchema = z.object({
  agentId: z.string(),
  promptTokensPattern: z.string(),
  completionTokensPattern: z.string(),
  costPattern: z.string().optional(),
  currency: z.string().default('USD'),
});

export type CostParsingRule = z.infer<typeof CostParsingRuleSchema>;

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

export interface IBenchmarkService {
  runBenchmark(config: SandboxConfig): Promise<{ coldStart: number, warmStart: number, hitRatio: number }>;
}

export interface EvalMetrics {
  
  regressions: string[]; // List of tests that started passing and then failed
  fixes: string[]; // List of tests that started failing and then passed
  totalTests: number;
  binarySuccess: boolean; // Pre-Fail && Post-Pass
}

export interface IEvaluator {
  evaluate(candidate: Candidate, cost?: number): Promise<EvaluationResult>;
}

export interface EvaluationResult {
  candidateId: string;
  regressionStatus: 'clean' | 'regressed' | 'error';
  comparison: ComparisonResult | null;
  preTestResults: TestResults | null;
  postTestResults: TestResults | null;
  latency: number;
  message: string;
  efficiency?: EfficiencyMetrics;
  eScore: number;
  semanticScore?: SemanticScore | null;
}

export interface IJudgeService {
  runEvaluationPipeline(
    candidates: Candidate[],
    agentId: string,
    costMap?: Map<string, number>,
    logPath?: string,
  ): Promise<EvaluationRunResult[]>;
}

export interface EvaluationRunResult {
  candidateId: string;
  result: EvaluationResult;
  cost?: number;
}

export interface ISemanticJudge {
  judge(code: string): Promise<SemanticScore>;
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
  logPath: z.string().optional(),
});

export type RunResult = z.infer<typeof RunResultSchema>;

export interface IRunResultRepository {
  save(run: RunResult): void;
  getById(runId: string): RunResult | undefined;
  getAll(): RunResult[];
  getByAgentId(agentId: string): RunResult[];
  getByCandidateId(candidateId: string): RunResult[];
}

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

// --- Batch Runner Types ---

export const BatchConfigSchema = z.object({
  agentIds: z.array(z.string()).min(1),
  candidateIds: z.array(z.string().uuid()).optional(),
  concurrency: z.number().int().min(1).max(10).default(2),
  timeoutPerRun: z.number().int().min(60_000).default(300_000),
  dryRun: z.boolean().default(false),
});

export type BatchConfig = z.infer<typeof BatchConfigSchema>;

export interface AgentRunSummary {
  agentId: string;
  totalRuns: number;
  successfulRuns: number;
  avgEScore: number;
  avgCost: number;
  avgLatency: number;
}

export interface BatchRunSummary {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  results: Map<string, AgentRunSummary>;
  totalDuration: number;
  startedAt: Date;
  completedAt: Date;
}

export interface IBatchRunner {
  runAll(config: BatchConfig): Promise<BatchRunSummary>;
  cancel(): void;
}

export interface WorkerTask<T> {
  id: string;
  fn: () => Promise<T>;
}

export interface WorkerResult<T> {
  id: string;
  status: 'fulfilled' | 'rejected';
  value?: T;
  error?: Error;
}

export interface IWorkerPool {
  exec<T>(tasks: WorkerTask<T>[]): Promise<WorkerResult<T>[]>;
  getActiveCount(): number;
  shutdown(): Promise<void>;
}

