/**
 * RepoBench Core Contracts
 * These interfaces define the boundaries between the different Epics.
 */

// --- Epic 1: The Miner ---
export type SandboxState = 'pre-fix' | 'post-fix' | 'unknown';

export interface CommitCandidate {
  hash: string;
  message: string;
  files: string[];
  status: 'pending' | 'validated' | 'rejected';
  metadata?: Record<string, any>;
}

export interface ICandidateRepository {
  saveMany(candidates: CommitCandidate[]): Promise<void>;
  findAll(): Promise<CommitCandidate[]>;
  findByStatus(status: CommitCandidate['status']): Promise<CommitCandidate[]>;
  updateStatus(hash: string, status: CommitCandidate['status']): Promise<void>;
  updateStatuses(updates: {hash: string, status: CommitCandidate['status']}[]): Promise<void>;
  findByHashes(hashes: string[]): Promise<CommitCandidate[]>;
  clear(): Promise<void>;
  close(): Promise<void>;
}

export interface IMiner {
  /**
   * Scans the repository and returns a list of potential bug-fix candidates.
   */
  mineCommits(): Promise<CommitCandidate[]>;
  
  /**
   * Refines the list of candidates using a Controller LLM.
   */
  curateCandidates(candidates: CommitCandidate[], limit: number): Promise<CommitCandidate[]>;
}

// --- Epic 2: The Sandbox ---
export interface SandboxOptions {
  repoPath: string;
  image: string;
  commitHash: string;
  buildCommand?: string;
  testCommand?: string;
  envVars?: Record<string, string>;
  baseImage?: string;
  baseImagePath?: string;
  cachePaths?: Record<string, string>;
  preBuildCommands?: string[];
  preBuildHashFile?: string;
  maxCachedLayers?: number;
}

export interface ISandbox {
  init(): Promise<void>;
  setup(): Promise<void>;
  verify(): Promise<boolean>;
  ping(): Promise<boolean>;
  execute(cmd: string, timeout?: number): Promise<string>;
  switchToState(commitHash: string): Promise<void>;
  destroy(): Promise<void>;
  getWorkingDir(): string;
}

// --- Epic 3: The Session ---
export interface SessionConfig {
  agentName: string;
  spawnCommand: string;
  interactionMap: Map<RegExp, string>;
  timeout: number;
}

export interface SessionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
  filesOpened: number;
  filesModified: number;
}

export interface ISession {
  start(): Promise<void>;
  write(text: string): Promise<void>;
  readUntil(regex: RegExp): Promise<string>;
  end(): Promise<SessionResult>;
  getFilesOpened(): number;
  getFilesModified(): number;
}

// --- Epic 4: The Judge ---
export interface SemanticEvaluation {
  correctness: number;
  maintainability: number;
  idiomaticity: number;
  justification: string;
}

export interface ISemanticJudge {
  evaluate(bugDesc: string, groundTruth: string, agentFix: string): Promise<SemanticEvaluation>;
}

export interface EvalMetrics {
  success: boolean;
  regressions: string[]; // List of tests that failed after the fix
  searchEfficiency: number; // Files modified / Files opened
  latency: number;
  cost: number;
  eScore: number;
  semantic?: SemanticEvaluation;
}


export interface VerificationResult {
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number;
  efficiencyRatio: number;
}

export interface IJudge {
  /**
   * Verifies if a fix is correct by checking the pre-fix and post-fix state.
   */
  verify(session: ISession, preFixHash: string, postFixHash: string, testCommand: string, bugDesc: string, groundTruth: string, agentFix: string): Promise<EvalMetrics>;

  /**
   * Runs a specific test command in the sandbox to verify a fix.
   */
  verifyFix(sandbox: ISandbox, testCommand: string): Promise<VerificationResult>;
  
  /**
   * Runs a suite of regression tests against a sandbox.
   */
  runRegressionSuite(sandbox: ISandbox): Promise<EvalMetrics>;
  
  /**
   * Calculates the final E-Score based on the metrics.
   */
  calculateScore(metrics: Partial<EvalMetrics>): number;
}

export interface RunRecord {
  id: string;
  agentId: string;
  candidateId: string;
  metrics: EvalMetrics;
  timestamp: Date;
  logsPath: string;
}

export interface IResultsRepository {
  saveRun(run: RunRecord): Promise<void>;
  getRunsForAgent(agentId: string): Promise<RunRecord[]>;
  getLeaderboard(): Promise<any[]>; // Returns ranked agents
  deleteRun(id: string): Promise<void>;
}
