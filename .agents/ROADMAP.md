# RepoBench Roadmap

This document serves as the central source of truth for the project's strategic goals, epics, and features. The Orchestrator agent MUST use the checkboxes `[ ]` (pending) and `[x]` (completed) to determine the next active task.

---

## [ ] Epic 1: Git-Based Benchmark Generation (The Miner)
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
* **[ ] Feature 1.6: Dataset Portability**
  * **Spec:** Build `DatasetExporter`/`DatasetImporter` for JSONL formats; add CLI commands.
  * **DoD:** Curated datasets can be exported/imported via a single file retaining all metadata.

---

## [ ] Epic 2: Deterministic Sandbox Infrastructure (The Sandbox)
**Description:** Create a 'Clean Room' environment for agent execution using Docker.
**Metrics:** Init Latency (<30s for standard projects), Setup Reliability (% of successful builds).
**Success Criteria:**
- [ ] Full Docker isolation with state reproduction via git and `build_command`.
- [ ] Automated resource teardown.

### Features
* **[ ] Feature 2.1: Configurable Environment Setup**
  * **Spec:** Add sandbox config to `repobench.yaml` (`build_command`, `test_command`, `env_vars`); update `Sandbox.init`.
  * **DoD:** Sandbox correctly initializes using custom build commands; tests run via config.
* **[ ] Feature 2.2: Robust Container Lifecycle Management**
  * **Spec:** Build `SandboxManager` to track/cleanup containers with `repobench` label; add timeouts.
  * **DoD:** Zero orphaned containers post-run; long-running processes are killed.
* **[ ] Feature 2.3: Pre-Fix vs Post-Fix State Switching**
  * **Spec:** Implement `Sandbox.switchState(hash)` optimized via `git checkout`.
  * **DoD:** Evaluator can seamlessly test `commit_pre_fix`, apply fix, and test the result.
* **[ ] Feature 2.4: Docker Image Optimization & Caching**
  * **Spec:** Support custom base images and Docker volumes for `node_modules`/`pip` caching.
  * **DoD:** Subsequent initialization times are significantly reduced.

---

## [ ] Epic 3: Interactive Agent Session Orchestration (The Session)
**Description:** Manage interactive CLI agent sessions using Pseudo-Terminals (PTY).
**Metrics:** Session Stability (% completing without hanging), Metadata Accuracy.
**Success Criteria:**
- [ ] Reliable wrapper, auto-approve scripts, and 'Done' signal detection.

### Features
* **[ ] Feature 3.1: PTY-Based Session Orchestration**
  * **Spec:** Integrate `node-pty` for real-time stdout/stderr I/O and state maintenance.
  * **DoD:** Agent interacts with the sandbox exactly as a real terminal.
* **[ ] Feature 3.2: Interactive Agent Adapter Framework**
  * **Spec:** Build `AgentAdapter` (abstract) with concrete classes for Aider/ClaudeCode; map interactions.
  * **DoD:** RepoBench launches specific agents via CLI arguments.
* **[ ] Feature 3.3: Auto-Approval & Interaction Logic**
  * **Spec:** Build `PromptHandler` to monitor PTY and inject auto-responses (e.g., 'y').
  * **DoD:** Prompts for file edits are automatically approved without human intervention.
* **[ ] Feature 3.4: Session Termination & Done Detection**
  * **Spec:** Scan stdout for completion signatures; implement session-level timeouts.
  * **DoD:** Orchestrator accurately terminates upon task completion or timeout.
* **[ ] Feature 3.5: Token & Cost Telemetry Scraper**
  * **Spec:** Build `CostParser` to extract token/cost data from agent outputs.
  * **DoD:** Output logs include precise financial cost per run.
* **[ ] Feature 3.6: Agent Configuration Management**
  * **Spec:** Define `agents.yaml` schema (Zod); load hyper-parameters via `BatchRunner`.
  * **DoD:** Experiments are 100% reproducible via YAML config files.

---

## [ ] Epic 4: The Evaluation & Scoring Engine (The Judge)
**Description:** Quantitative scoring of agent output via execution and regression testing.
**Metrics:** Verification Accuracy (Correlation with human judgment), Scoring Variance.
**Success Criteria:**
- [ ] Binary verification and regression detection.
- [ ] Implement E-Score tracking.

### Features
* **[ ] Feature 4.1: Full Regression Suite Execution**
  * **Spec:** Execute full `test_command` to compare passing tests before and after the fix.
  * **DoD:** Fixes are marked failed if they introduce new test regressions.
* **[ ] Feature 4.2: Search Efficiency Tracker**
  * **Spec:** Log file access within Docker to calculate ratio: $\text{Files Accessed} / \text{Files Modified}$.
  * **DoD:** Reports include the agent's file-scanning efficiency metric.
* **[ ] Feature 4.3: E-Score Implementation**
  * **Spec:** Implement formula: $$E\text{-Score} = \frac{\text{Success}}{\text{Cost} \times \log(\text{Latency})} \times \text{Efficiency\_Multiplier}$$
  * **DoD:** Every run generates a valid, comparable E-Score.
* **[ ] Feature 4.4: LLM-Based 'Semantic Judge'**
  * **Spec:** Call LLM to rate Correctness, Maintainability, and Idiomaticity (1-5).
  * **DoD:** Reports include nuanced semantic scores alongside binary results.

---

## [ ] Epic 5: Comparative Analysis & Reporting (The Leaderboard)
**Description:** Transform raw run data into a decision tool for tool selection.
**Metrics:** Throughput (Candidate-agent pairs/hr), Actionability (Time to identify best tool).
**Success Criteria:**
- [ ] Multi-agent execution with SQLite storage and CLI Leaderboard.

### Features
* **[ ] Feature 5.1: Results Persistence Layer**
  * **Spec:** Integrate `better-sqlite3`; schema for runs tracking agent, candidate, cost, E-Score.
  * **DoD:** 100% of runs persist safely to the local DB.
* **[ ] Feature 5.2: Multi-Agent Batch Runner**
  * **Spec:** Build `BatchRunner` with worker pools to handle concurrent Docker limits.
  * **DoD:** `repobench run-all` processes candidates across multiple agents seamlessly.
* **[ ] Feature 5.3: CLI Leaderboard View**
  * **Spec:** Build `report` command to query SQLite and aggregate metrics (Avg E-Score, Success Rate).
  * **DoD:** Terminal renders a sorted, ranked table of agent performance.
* **[ ] Feature 5.4: Failure Artifact Exporter**
  * **Spec:** Export `diff.patch`, `session.log`, and ground truth fix to `exports/<run_id>/`.
  * **DoD:** Developers can pull failure states locally for IDE inspection.
