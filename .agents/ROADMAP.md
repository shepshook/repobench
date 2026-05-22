# RepoBench Roadmap

This document serves as the central source of truth for the project's strategic goals, epics, and features. The Orchestrator agent MUST use the checkboxes `[ ]` (pending) and `[x]` (completed) to determine the next active task.

---

## [x] Epic 1: Git-Based Benchmark Generation (The Miner)
**Description:** Automate the discovery of high-signal 'ground truth' benchmarks from a private repository.
**Metrics:** Precision (>80% actual bug fixes), Candidate Density (High-quality candidates per 1k commits).
**Success Criteria:**
- [ ] Implement 'Pure Fix' heuristics.
- [ ] Filter out noise (refactors, docs).
- [ ] Support `repobench.yaml` for keywords/exclusions.
- [ ] Export candidates to structured format.

### Features
* **[x] Feature 1.1: Configurable Mining Heuristics**
  * **Spec:** Parse `repobench.yaml` (keywords, `exclude_paths`); update `Miner.mineCommits`.
  * **Tasks:**
    - [x] [Task 1.1.1: Configuration Schema & Parser](.agents/spec/task-1.1.1.md)
    - [x] [Task 1.1.2: Miner Interface & Basic Implementation](.agents/spec/task-1.1.2.md)
    - [x] [Task 1.1.3: Keyword & Path Filtering Logic](.agents/spec/task-1.1.3.md)
    - [x] [Task 1.1.4: Integration & CLI Command](.agents/spec/task-1.1.4.md)
  * **DoD:** Custom config successfully filters commits and ignores specified paths.
* **[x] Feature 1.2: Pure-Fix Quality Filter**
  * **Spec:** Implement 'Significance Filter' to ignore whitespace/comment-only test changes.
  * **Tasks:**
    - [x] [Task 1.2.1: Significance Filter Interface](.agents/spec/task-1.2.1.md)
    - [x] [Task 1.2.2: Filter Validation Suite](.agents/spec/task-1.2.2.md)
    - [x] [Task 1.2.3: BasicSignificanceFilter Implementation](.agents/spec/task-1.2.3.md)
    - [x] [Task 1.2.4: Pipeline Integration](.agents/spec/task-1.2.4.md)
    - [x] [Task 1.2.5: File-Level Noise Filtering](.agents/spec/task-1.2.5.md)
    - [x] [Task 1.2.6: Purity Threshold Tuning](.agents/spec/task-1.2.6.md)
  * **DoD:** Meaningful test additions are captured; trivial comment changes are discarded.
* **[x] Feature 1.3: Candidate Persistence Layer**
  * **Spec:** Integrate `better-sqlite3`; create `candidates` table and `CandidateRepository`.
  * **Tasks:**
    - [x] [Task 1.3.1: Define Candidate Entity & Repository Interface](.agents/spec/task-1.3.1.md)
    - [x] [Task 1.3.2: SQLite Infrastructure Setup](.agents/spec/task-1.3.2.md)
    - [x] [Task 1.3.3: CandidateRepository Implementation & Testing](.agents/spec/task-1.3.3.md)
    - [x] [Task 1.3.4: GitMiner Integration](.agents/spec/task-1.3.3.md)
  * **DoD:** Candidates persist to `repobench.db` without duplicates on repeated runs.
* **[x] Feature 1.4: LLM-Based Candidate Curation**
  * **Spec:** Build `CurationService` (e.g., GPT-4o-mini) to extract, rank, and validate raw candidates.
  * **Tasks:**
    - [x] [Task 1.4.1: Curation Service Contract Definition](.agents/spec/task-1.4.1.md)
    - [x] [Task 1.4.2: OpenAICurationService Implementation](.agents/spec/task-1.4.2.md)
    - [x] [Task 1.4.3: Integration Loop for Curation](.agents/spec/task-1.4.3.md)
  * **DoD:** Reduces 100+ raw candidates to a curated set with logged LLM reasoning.
* **[x] Feature 1.5: Benchmark Validation**
  * **Spec:** Build `BenchmarkValidator` using `ISandbox` to verify Pre-fix (Fail) $\rightarrow$ Post-fix (Pass).
  * **Tasks:**
    - [x] [Task 1.5.1: Validation Contract & Schema](.agents/spec/task-1.5.1.md)
    - [x] [Task 1.5.2: BenchmarkValidator Implementation](.agents/spec/task-1.5.2.md)
    - [x] [Task 1.5.3: Integration with Candidate Pipeline](.agents/spec/task-1.5.3.md)
    - [x] [Task 1.5.4: Validation Reporting & Logging](.agents/spec/task-1.5.4.md)
  * **DoD:** Only validated candidates reach the orchestrator; rejections are logged.
* **[x] Feature 1.6: Dataset Portability**
  * **Spec:** Build `DatasetExporter`/`DatasetImporter` for JSONL formats; add CLI commands.
  * **Tasks:**
    - [x] [Task 1.6.1: Define Exporter/Importer Contracts & JSONL Schema](.agents/spec/task-1.6.1.md)
    - [x] [Task 1.6.2: Implement JSONL DatasetExporter](.agents/spec/task-1.6.2.md)
    - [x] [Task 1.6.3: Implement JSONL DatasetImporter](.agents/spec/task-1.6.3.md)
    - [x] [Task 1.6.4: CLI Integration for Dataset Portability](.agents/spec/task-1.6.4.md)
    - [x] [Task 1.6.FIX: Feature Review Alignment](.agents/spec/task-1.6.fix.md)
    - [x] [Task 1.6.FIX: Feature Review Alignment](.agents/spec/task-1.6.fix.md)
    - [x] [Task 1.6.FIX: Feature Review Alignment](.agents/spec/task-1.6.fix.md)
    - [x] [Task 1.6.FIX1: Feature Review Alignment Round 1](.agents/spec/task-1.6.fix1.md)
    - [x] [Task 1.6.FIX2: Feature Review Alignment Round 2](.agents/spec/task-1.6.fix2.md)
    - [x] [Task 1.6.FIX3: Feature Review Alignment Round 3](.agents/spec/task-1.6.fix3.md)
    - [x] [Task 1.6.FIX4: Feature Review Alignment Round 4](.agents/spec/task-1.6.fix4.md)
    - [x] [Task 1.6.FIX5: Fix Miner Candidate Type Errors](.agents/spec/task-1.6.fix5.md)
    - [x] [Task 1.6.FIX6: Fix DatasetImporter Type Definition](.agents/spec/task-1.6.fix6.md)
    - [x] [Task 1.6.FIX7: Fix DatasetImporter Deduplication](.agents/spec/task-1.6.fix7.md)
    - [x] [Task 1.6.FIX8: Fix Database Initialization in Integration Tests](.agents/spec/task-1.6.fix8.md)
  * **DoD:** Curated datasets can be exported/imported via a single file retaining all metadata.

---

## [x] Epic 2: Deterministic Sandbox Infrastructure (The Sandbox)
**Description:** Create a 'Clean Room' environment for agent execution using Docker.
**Metrics:** Init Latency (<30s for standard projects), Setup Reliability (% of successful builds).
**Success Criteria:**
- [ ] Full Docker isolation with state reproduction via git and `build_command`.
- [ ] Automated resource teardown.

### Features
* **[x] Feature 2.1: Configurable Environment Setup**
  * **Spec:** Add sandbox config to `repobench.yaml` (`build_command`, `test_command`, `env_vars`); update `Sandbox.init`.
  * **Tasks:**
    - [x] [Task 2.1.1: Configuration Schema & Parser](.agents/spec/task-2.1.1.md)
    - [x] [Task 2.1.2: Sandbox Implementation & Contracts](.agents/spec/task-2.1.2.md)
    - [x] [Task 2.1.3: Integration Testing Suite](.agents/spec/task-2.1.3.md)
  * **DoD:** Sandbox correctly initializes using custom build commands; tests run via config.
* **[x] Feature 2.2: Robust Container Lifecycle Management**
  * **Spec:** Build `SandboxManager` to track/cleanup containers with `repobench` label; add timeouts, use `ContainerRepository` for persistence.
  * **Tasks:**
    - [x] [Task 2.2.1: SandboxManager Interface Definition & Persistence Setup](.agents/spec/task-2.2.1.md)
    - [x] [Task 2.2.2: ContainerRepository & SandboxManager Implementation](.agents/spec/task-2.2.2.md)
    - [x] [Task 2.2.3: Timeout Logic, Resource Teardown, and Error Handling](.agents/spec/task-2.2.3.md)
    - [x] [Task 2.2.FIX1: Audit SandboxManager cleanupOrphanedContainers error handling](.agents/spec/task-2.2.fix1.md)
    - [x] [Task 2.2.FIX2: Fix SandboxManager cleanupOrphanedContainers error handling](.agents/spec/task-2.2.fix2.md)
    - [x] [Task 2.2.FIX3: Consolidate Error Handling in SandboxManager](.agents/spec/task-2.2.fix3.md)
    - [x] [Task 2.2.FIX4: Update SandboxManager Tests to Assert Rejection](.agents/spec/task-2.2.fix4.md)
    - [x] [Task 2.2.FIX5: Reconcile SandboxManager cleanupOrphanedContainers Error Handling with Tests](.agents/spec/task-2.2.fix5.md)
  * **DoD:** Zero orphaned containers post-run; long-running processes are killed.
* **[x] Feature 2.3: Pre-Fix vs Post-Fix State Switching**
  * **Spec:** Implement `Sandbox.switchState(hash)` optimized via `git checkout`.
  * **Tasks:**
    - [x] [Task 2.3.1: Define ISandbox interface for switchState](.agents/spec/task-2.3.1.md)
    - [x] [Task 2.3.2: Implement Sandbox.switchState using git checkout](.agents/spec/task-2.3.2.md)
    - [x] [Task 2.3.3: Add verification tests for state switching](.agents/spec/task-2.3.3.md)
  * **DoD:** Evaluator can seamlessly test `commit_pre_fix`, apply fix, and test the result.
* **[x] Feature 2.4: Docker Image Optimization & Caching**
  * **Spec:** Support custom base images and Docker volumes for `node_modules`/`pip` caching with cache invalidation and lifecycle management.
  * **Tasks:**
    - [x] [Task 2.4.1: Research & Define Caching Strategy](.agents/spec/task-2.4.1.md)
    - [x] [Task 2.4.2: Infrastructure Implementation (Volumes/Base Images)](.agents/spec/task-2.4.2.md)
    - [x] [Task 2.4.3: Cache Lifecycle Management](.agents/spec/task-2.4.3.md)
    - [x] [Task 2.4.4: Verification & Performance Benchmarking](.agents/spec/task-2.4.4.md)
    - [x] [Task 2.4.FIX1: Fix VolumeManager Docker Interaction](.agents/spec/task-2.4.fix1.md)
    - [x] [Task 2.4.FIX2: Fix Sandbox Caching Persistence & Invalidation](.agents/spec/task-2.4.fix2.md)
    - [x] [Task 2.4.FIX3: Fix Sandbox Base Image Configuration](.agents/spec/task-2.4.fix3.md)
    - [x] [Task 2.4.FIX4: Fix VolumeManager Concurrency](.agents/spec/task-2.4.fix4.md)
    - [x] [Task 2.4.FIX5: Fix Caching Stats & Volume Mounting](.agents/spec/task-2.4.fix5.md)
    - [x] [Task 2.4.FIX6: Investigate and Fix Test Suite Failures](.agents/spec/task-2.4.fix6.md)
  * **DoD:** Subsequent initialization times are significantly reduced; cache does not grow unboundedly; dependencies are correctly invalidated.

---

## [x] Epic 3: Interactive Agent Session Orchestration (The Session)
**Description:** Manage interactive CLI agent sessions using Pseudo-Terminals (PTY).
**Metrics:** Session Stability (% completing without hanging), Metadata Accuracy.
**Success Criteria:**
- [ ] Reliable wrapper, auto-approve scripts, and 'Done' signal detection.

### Features
* **[x] Feature 3.1: PTY-Based Session Orchestration**
  * **Spec:** Integrate `node-pty` for real-time stdout/stderr I/O and state maintenance.
  * **Note:** `Sandbox` uses a dual-path execution model. Direct `docker.exec` for batch/infrastructure commands (`execute()`), and `PtySession.create()` for interactive agent TTY sessions. See `ARCHITECTURE.md §6` for the rationale.
  * **Tasks:**
    - [x] [Task 3.1.1: Research & Prototype node-pty Integration](.agents/spec/task-3.1.1.md)
    - [x] [Task 3.1.2: Implement PtySession Service](.agents/spec/task-3.1.2.md)
    - [x] [Task 3.1.3: Sandbox Orchestration Integration](.agents/spec/task-3.1.3.md)
    - [x] [Task 3.1.4: Verify Terminal Emulation & State Maintenance](.agents/spec/task-3.1.4.md)
    - [x] [Task 3.1.FIX1: Resolve Windows PTY AttachConsole Race Condition](.agents/spec/task-3.1.fix1.md)
    - [x] [Task 3.1.FIX2: Fix PTY Terminal Simulation Compatibility](.agents/spec/task-3.1.fix2.md)
    - [x] [Task 3.1.FIX3: Improve PTY Test Robustness](.agents/spec/task-3.1.fix3.md)
    - [x] [Task 3.1.FIX4: Audit and Resolve PTY EPIPE Errors in Stress Tests](.agents/spec/task-3.1.fix4.md)
    - [x] [Task 3.1.FIX5: Audit PTY Concurrency Issues Round 1](.agents/spec/task-3.1.fix5.md)
    - [x] [Task 3.1.FIX6: Fix PTY Race Condition in Write/Close Round 1](.agents/spec/task-3.1.fix6.md)
    - [x] [Task 3.1.FIX7: Audit PtySession State Transitions and Lock Mechanism](.agents/spec/task-3.1.fix7.md)
    - [x] [Task 3.1.FIX8: Implement Robust PtySession Lock and State Management](.agents/spec/task-3.1.fix8.md)
    - [x] [Task 3.1.FIX9: Update PtySession Tests to Assert Concurrent Safety](.agents/spec/task-3.1.fix9.md)
    - [x] [Task 3.1.FIX10: Audit PTY Alpine shell environment and missing utilities](.agents/spec/task-3.1.fix10.md)

  * **DoD:** Agent interacts with the sandbox exactly as a real terminal.
* **[x] Feature 3.2: Interactive Agent Adapter Framework**
  * **Spec:** Build `AgentAdapter` (abstract) with concrete classes for Aider/ClaudeCode; map interactions via factory.
  * **Tasks:**
    - [x] [Task 3.2.1: Define IAgentAdapter Contract & Base Adapter](.agents/spec/task-3.2.1.md)
    - [x] [Task 3.2.2: Implement AiderAdapter](.agents/spec/task-3.2.2.md)
    - [x] [Task 3.2.3: Implement ClaudeCodeAdapter](.agents/spec/task-3.2.3.md)
    - [x] [Task 3.2.4: Integrate Adapter Selection in SessionOrchestrator](.agents/spec/task-3.2.4.md)
    - [x] [Task 3.2.FIX1: Audit and Fix PtySession Adapter Compatibility](.agents/spec/task-3.2.fix1.md)
  * **DoD:** RepoBench launches specific agents via CLI arguments using adapter factory.
* **[x] Feature 3.3: Auto-Approval & Interaction Logic**
  * **Spec:** Build `PromptHandler` to monitor PTY and inject auto-responses (e.g., 'y') using state-synchronized injection and rollback-capable safety layer.
  * **Tasks:**
    - [x] [Task 3.3.1: Define IPromptHandler and InteractionRule Schema](.agents/spec/task-3.3.1.md)
    - [x] [Task 3.3.2: Implement PromptHandler Logic](.agents/spec/task-3.3.2.md)
    - [x] [Task 3.3.3: Implement Response Injection & Synchronization](.agents/spec/task-3.3.3.md)
    - [x] [Task 3.3.4: Integration & Verification](.agents/spec/task-3.3.4.md)
    - [x] [Task 3.3.5: Implement Rollback Mechanism](.agents/spec/task-3.3.5.md)
    - [x] [Task 3.3.FIX1: Fix SessionOrchestrator Test Mock Sandbox](.agents/spec/task-3.3.fix1.md)
    - [x] [Task 3.3.FIX2: Fix PromptHandler Integration Test Sandbox Init](.agents/spec/task-3.3.fix2.md)
    - [x] [Task 3.3.FIX3: Fix PTY Injection Synchronization Test](.agents/spec/task-3.3.fix3.md)
    - [x] [Task 3.3.FIX4: Fix PtySession Injection Sync Test — Echo Commands](.agents/spec/task-3.3.fix4.md)
    - [x] [Task 3.3.FIX5: Fix PTY Sync Failure Test — Echo Commands](.agents/spec/task-3.3.fix5.md)
  * **DoD:** Prompts for file edits are automatically approved without human intervention; system safely handles concurrency and rollbacks failures.
* **[x] Feature 3.4: Session Termination & Done Detection**
  * **Spec:** Scan stdout for completion signatures; implement session-level timeouts.
  * **Tasks:**
    - [x] [Task 3.4.1: Define IDoneDetector interface and completion signature schemas](.agents/spec/task-3.4.1.md)
    - [x] [Task 3.4.2: Implement DoneDetector service with regex scanning](.agents/spec/task-3.4.2.md)
    - [x] [Task 3.4.3: Implement session-level timeout mechanism in PtySession](.agents/spec/task-3.4.3.md)
    - [x] [Task 3.4.4: Integrate DoneDetector and timeout management into SessionOrchestrator](.agents/spec/task-3.4.4.md)
    - [x] [Task 3.4.FIX1: Audit IPtySession Mock Alignment Round 1](.agents/spec/task-3.4.fix1.md)
  * **DoD:** Orchestrator accurately terminates upon task completion or timeout.
* **[x] Feature 3.5: Token & Cost Telemetry Scraper**
  * **Spec:** Build `CostParser` to extract token/cost data from agent outputs.
  * **Tasks:**
    - [x] [Task 3.5.1: Define CostParser Contract & Schema](.agents/spec/task-3.5.1.md)
    - [x] [Task 3.5.2: Implement CostParser Service](.agents/spec/task-3.5.2.md)
    - [x] [Task 3.5.3: Integrate CostParser into SessionOrchestrator](.agents/spec/task-3.5.3.md)
    - [x] [Task 3.5.4: Verification & Regression Testing](.agents/spec/task-3.5.4.md)
  * **DoD:** Output logs include precise financial cost per run.
* **[x] Feature 3.6: Agent Configuration Management**
  * **Spec:** Define `agents.yaml` schema (Zod); load hyper-parameters into `SessionOrchestrator`.
  * **Tasks:**
    - [x] [Task 3.6.1: Define Agent Configuration Schema](.agents/spec/task-3.6.1.md)
    - [x] [Task 3.6.2: Implement Agent Configuration Loader](.agents/spec/task-3.6.2.md)
    - [x] [Task 3.6.3: Integrate AgentConfig into SessionOrchestrator](.agents/spec/task-3.6.3.md)
    - [x] [Task 3.6.4: Verification & Integration Testing](.agents/spec/task-3.6.4.md)
    - [x] [Task 3.6.FIX1: Fix cliArgs Duplication in PtySession Integration](.agents/spec/task-3.6.fix1.md)
    - [x] [Task 3.6.FIX2: Fix Lint Errors in session-orchestrator.ts and agent-config-loader.ts](.agents/spec/task-3.6.fix2.md)
    - [x] [Task 3.6.FIX3: Fix Test Assertions Broken by FIX1/FIX2 Changes Round 1](.agents/spec/task-3.6.fix3.md)
    - [x] [Task 3.6.FIX4: Create agents.example.yaml Reference File](.agents/spec/task-3.6.fix4.md)
    - [x] [Task 3.6.FIX5: Fix Misaligned Test Names and Spec File Checkboxes Round 1](.agents/spec/task-3.6.fix5.md)
   * **DoD:** Experiments are 100% reproducible via YAML config files.
* **[x] Feature 3.FIX1: Global Epic Integration & Alignment Round 1**
  * **Spec:** Resolve cross-feature boundary leak in PromptHandler pipeline; clean up redundant optional chaining and empty source directories.
  * **Tasks:**
    - [x] [Task 3.FIX1.1: Fix Double PromptHandler Invocation Leak](.agents/spec/task-3.fix1.1.md)
    - [x] [Task 3.FIX1.2: Clean Up Redundant Optional Chaining & Structural Bounds](.agents/spec/task-3.fix1.2.md)
  * **DoD:** PromptHandler invoked exactly once per data chunk; no double auto-response injection. `onData` call uses direct invocation without `?.`. Empty `src/` subdirectories cleaned or documented.

---

## [x] Epic 4: The Evaluation & Scoring Engine (The Judge)
**Description:** Quantitative scoring of agent output via execution and regression testing.
**Metrics:** Verification Accuracy (Correlation with human judgment), Scoring Variance.
**Success Criteria:**
- [x] Binary verification and regression detection.
- [x] Implement E-Score tracking.

### Features
* **[x] Feature 4.1: Full Regression Suite Execution**
  * **Spec:** Execute full `test_command` to compare passing tests before and after the fix.
  * **Tasks:**
    - [x] [Task 4.1.1: Design and Implement IRegressionTestRunner Interface](.agents/spec/task-4.1.1.md)
    - [x] [Task 4.1.2: Implement RegressionTestRunner Service](.agents/spec/task-4.1.2.md)
    - [x] [Task 4.1.3: Integrate RegressionTestRunner into Evaluator Pipeline](.agents/spec/task-4.1.3.md)
    - [x] [Task 4.1.4: Add Regression Test Verification Suite](.agents/spec/task-4.1.4.md)
    - [x] [Task 4.1.FIX1: Fix Evaluator Test Latency Assertion Round 1](.agents/spec/task-4.1.fix1.md)
   * **DoD:** Fixes are marked failed if they introduce new test regressions.
* **[x] Feature 4.2: Search Efficiency Tracker**
  * **Spec:** Log file access within Docker to calculate ratio: $\text{Files Accessed} / \text{Files Modified}$.
  * **Tasks:**
    - [x] [Task 4.2.1: Design File Access Interception Mechanism](.agents/spec/task-4.2.1.md)
    - [x] [Task 4.2.2: Define ISearchEfficiencyTracker & EfficiencyMetrics Schema](.agents/spec/task-4.2.2.md)
    - [x] [Task 4.2.3: Implement SearchEfficiencyTracker Service](.agents/spec/task-4.2.3.md)
    - [x] [Task 4.2.4: Integrate SearchEfficiencyTracker into EvaluatorPipeline](.agents/spec/task-4.2.4.md)
    - [x] [Task 4.2.5: Add SearchEfficiencyTracker Verification Suite](.agents/spec/task-4.2.5.md)
  * **DoD:** Reports include the agent's file-scanning efficiency metric.
* **[x] Feature 4.3: E-Score Implementation**
  * **Spec:** Implement formula: $$E\text{-Score} = \frac{\text{Success}}{\text{Cost} \times \log(\text{Latency})} \times \text{Efficiency\_Multiplier}$$
  * **Tasks:**
    - [x] [Task 4.3.1: Define IScorer Interface and E-Score Formula Contract](.agents/spec/task-4.3.1.md)
    - [x] [Task 4.3.2: Implement EScoreService](.agents/spec/task-4.3.2.md)
    - [x] [Task 4.3.3: Integration into EvaluatorPipeline](.agents/spec/task-4.3.3.md)
    - [x] [Task 4.3.4: Verification & Test Suite](.agents/spec/task-4.3.4.md)
    - [x] [Task 4.3.FIX1: Fix contracts.test.ts Parse Error — Dangling `});` and Orphaned it() Calls](.agents/spec/task-4.3.fix1.md)
  * **DoD:** Every run generates a valid, comparable E-Score; edge cases (Cost/Latency) are handled.
* **[x] Feature 4.4: LLM-Based 'Semantic Judge'**
  * **Spec:** Call LLM to rate Correctness, Maintainability, and Idiomaticity (1-5).
  * **Tasks:**
    - [x] [Task 4.4.1: Define ISemanticJudge interface and SemanticScore schema](.agents/spec/task-4.4.1.md)
    - [x] [Task 4.4.2: Implement LLMSemanticJudge service](.agents/spec/task-4.4.2.md)
    - [x] [Task 4.4.3: Integrate SemanticJudge into EvaluatorPipeline](.agents/spec/task-4.4.3.md)
    - [x] [Task 4.4.4: Verification & Test Suite](.agents/spec/task-4.4.4.md)
  * **DoD:** Reports include nuanced semantic scores alongside binary results.
* **[x] Feature 4.FIX1: Global Epic Integration & Alignment Round 1**
  * **Spec:** Resolve cross-module SessionOrchestrator→Evaluator cost-data boundary leak; mark implemented success criteria; remediate better-sqlite3 native binding; audit and fix system-wide lint regression root causes.
  * **Tasks:**
    - [x] [Task 4.FIX1.1: Wire SessionOrchestrator Cost Data into Evaluator Pipeline](.agents/spec/task-4.fix1.1.md)
    - [x] [Task 4.FIX1.2: Rebuild better-sqlite3 Native Bindings & Validate Persistence Layer](.agents/spec/task-4.fix1.2.md)
    - [x] [Task 4.FIX1.3: Remediate System-Wide Lint Regression — Infrastructure Files](.agents/spec/task-4.fix1.3.md)
    - [x] [Task 4.FIX1.4: Audit Cross-Module Boundary Leaks & Final Integration Verification](.agents/spec/task-4.fix1.4.md)
  * **DoD:** Cost data flows from SessionOrchestrator through JudgeService into E-Score formula; persistence tests pass; lint ≤ tolerance threshold (no `any`-typed member access in core services); all 9 Epic 4 test files + integration tests pass end-to-end.

---

## [ ] Epic 5: Comparative Analysis & Reporting (The Leaderboard)
**Description:** Transform raw run data into a decision tool for tool selection.
**Metrics:** Throughput (Candidate-agent pairs/hr), Actionability (Time to identify best tool).
**Success Criteria:**
- [ ] Multi-agent execution with SQLite storage and CLI Leaderboard.

### Features
* **[x] Feature 5.1: Results Persistence Layer**
  * **Spec:** Integrate `better-sqlite3`; schema for runs tracking agent, candidate, cost, E-Score.
  * **Tasks:**
    - [x] [Task 5.1.1: Define RunResult Entity & Repository Interface](.agents/spec/task-5.1.1.md)
    - [x] [Task 5.1.2: SQLite Schema for Run Results](.agents/spec/task-5.1.2.md)
    - [x] [Task 5.1.3: Implement RunResultRepository & Tests](.agents/spec/task-5.1.3.md)
    - [x] [Task 5.1.4: Integration into Evaluation Pipeline](.agents/spec/task-5.1.4.md)
  * **DoD:** 100% of runs persist safely to the local DB.
* **[x] Feature 5.2: Multi-Agent Batch Runner**
  * **Spec:** Build `BatchRunner` with worker pools to handle concurrent Docker limits.
  * **Tasks:**
    - [x] [Task 5.2.1: Define BatchRunner Contract, BatchConfig & WorkerPool Interface](.agents/spec/task-5.2.1.md)
    - [x] [Task 5.2.2: Implement WorkerPool Service](.agents/spec/task-5.2.2.md)
    - [x] [Task 5.2.3: Implement BatchRunner Orchestration Logic](.agents/spec/task-5.2.3.md)
    - [x] [Task 5.2.4: Implement Progress Tracking, Error Aggregation & Summary Reporter](.agents/spec/task-5.2.4.md)
    - [x] [Task 5.2.5: CLI Integration (`repobench run-all`)](.agents/spec/task-5.2.5.md)
    - [x] [Task 5.2.FIX1: Fix BatchRunnerService Test Constructor Mock](.agents/spec/task-5.2.fix1.md)
    - [x] [Task 5.2.FIX2: Fix BatchContractsTest Incorrect Assertions](.agents/spec/task-5.2.fix2.md)
    - [x] [Task 5.2.FIX3: Fix batch-runner-di.test.ts Mock Exec Not Invoking Tasks](.agents/spec/task-5.2.fix3.md)
  * **DoD:** `repobench run-all` processes candidates across multiple agents seamlessly. All Feature 5.2 tests pass (batch-runner, batch-contracts, worker-pool, batch-progress-reporter, run-all-cli).
* **[x] Feature 5.3: CLI Leaderboard View**
  * **Spec:** Build `report` command to query SQLite and aggregate metrics (Avg E-Score, Success Rate).
  * **Tasks:**
    - [x] [Task 5.3.1: Define Leaderboard Query Contract & Options Schema](.agents/spec/task-5.3.1.md)
    - [x] [Task 5.3.2: Implement LeaderboardReporter Service & Tests](.agents/spec/task-5.3.2.md)
    - [x] [Task 5.3.3: Implement Terminal Table Renderer for Report Output](.agents/spec/task-5.3.3.md)
    - [x] [Task 5.3.4: CLI Integration (`repobench report`) & Verification](.agents/spec/task-5.3.4.md)
  * **DoD:** Terminal renders a sorted, ranked table of agent performance.
* **[ ] Feature 5.4: Failure Artifact Exporter**
  * **Spec:** Export `diff.patch`, `session.log`, and ground truth fix to `exports/<run_id>/`.
  * **Tasks:**
    - [x] [Task 5.4.1: Define FailureArtifact Contracts & IFailureArtifactExporter Interface](.agents/spec/task-5.4.1.md)
    - [ ] [Task 5.4.2: Implement FailureArtifactExporter Service](.agents/spec/task-5.4.2.md)
    - [ ] [Task 5.4.3: Integrate FailureArtifactExporter into Evaluation Pipeline](.agents/spec/task-5.4.3.md)
    - [ ] [Task 5.4.4: CLI Integration (`repobench export-failures`)](.agents/spec/task-5.4.4.md)
  * **DoD:** Developers can pull failure states locally for IDE inspection.
