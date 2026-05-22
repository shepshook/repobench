# RepoBench Architecture & Design System

This document defines the architectural constraints, patterns, and standards for the RepoBench project. All subagents must adhere to these rules to ensure system integrity.

## 1. System Overview

RepoBench is a modular benchmarking suite designed to evaluate AI coding agents in a deterministic environment. The system follows a **Pipe-and-Filter** architecture:

`Git Repo` $\rightarrow$ `Miner` $\rightarrow$ `SQLite (Candidates)` $\rightarrow$ `Sandbox` $\rightarrow$ `Session (Agent)` $\rightarrow$ `Judge` $\rightarrow$ `Leaderboard`

## 2. Core Modules

| Module | Responsibility | Key Interfaces |
| --- | --- | --- |
| **Miner** | Heuristic-based discovery of bug fixes from Git history. | `IMiner`, `IHeuristic` |
| **Sandbox** | Docker-based isolation and state management (Pre/Post-fix). | `ISandbox`, `IVolumeManager` |
| **Session** | PTY-based orchestration of interactive CLI agents. | `IAgentAdapter`, `IPtySession` |
| **Judge** | Scoring via regression testing and E-Score formulas. | `IEvaluator`, `IScorer` |
| **Leaderboard** | Persistence and reporting of comparative data. | `IRepository` |

---

## 3. Design Patterns

### 3.1. The Adapter Pattern (Agent Integration)

To support multiple agents (Aider, ClaudeCode, OpenDevin), we use the **Adapter Pattern**.

* **Constraint**: Never write agent-specific logic in the `SessionOrchestrator`.
* **Implementation**: All new agents must implement the `IAgentAdapter` interface and provide a regex-based `interactionMap`.

### 3.2. Repository Pattern (Persistence)

Direct SQL queries are forbidden outside of the Repository layer.

* **Location**: `src/core/repositories/`
* **Tooling**: Use `better-sqlite3` for synchronous-like local performance within async wrappers.

### 3.3. Contract-First Development

All domain models and service interfaces must be defined in `src/core/contracts.ts` before implementation begins. Subagents must read this file before editing `src/`.

---

## 4. Coding Standards & Conventions

### 4.1. Naming Conventions

* **Classes**: PascalCase (e.g., `MiningService`).
* **Interfaces**: PascalCase prefixed with `I` (e.g., `ISandbox`).
* **Variables/Functions**: camelCase (e.g., `runTypecheck()`).
* **Files**: kebab-case (e.g., `candidate-repository.ts`).

### 4.2. Directory Structure

```text
src/
├── cli/            # Command-line entry points (No business logic)
├── core/           # Pure domain logic and contracts
│   ├── contracts.ts
│   ├── services/   # Orchestration logic
│   └── entities/   # Data models
├── infrastructure/ # Implementation details (Docker, SQLite, PTY)
└── utils/          # Shared helpers (Logger, Parser)

```

### 4.3. Error Handling
* **No Silent Failures**: Do not swallow errors. Wrap I/O (Docker, Git, PTY) in `try/catch` blocks *only* when a recovery path exists. If an error should trigger a fallback (e.g., Docker $\rightarrow$ Simulation) or fail the operation, it must bubble up to the orchestrator.
* **RCA Requirement**: Throw descriptive errors that include the `stdout` or `stderr` context to assist the Orchestrator's Root Cause Analysis.

---

## 5. State Management Loop

The project uses **File-Based Memory** to manage context overflow:

1. **ROADMAP.md**: High-level task status.
2. **ARCHITECTURE.md**: Global constraints (this file).
3. **MEMORY.md**: Transient task-specific context and RCA results.

**Mandate**: Before every `edit`, the agent must verify the change against the `contracts.ts` interfaces and the naming conventions defined here.

---

## 6. Infrastructure Specifics

* **Docker**: All images must be labeled with `app=repobench` for automated cleanup.
* **Batch Command Execution**: Use `container.exec()` (Docker's native exec API) for non-interactive infrastructure commands (git operations, build commands, test commands). This provides clean stdout/stderr separation via multiplexed streams, direct exit codes via `exec.inspect()`, and avoids unnecessary PTY overhead. Do NOT route batch commands through `PtySession` — they don't need a TTY and benefit from the simpler, faster direct-exec path.
* **Interactive Sessions (Agents)**: Use `node-pty` via `PtySession.create()` for AI agent sessions that require TTY interaction. The worker-based architecture (`pty-worker.cjs`) provides terminal emulation (`VirtualScreen`), ECMA-48 compliant ANSI parsing (`VteParser`), and stateful shell interaction. Do not use `child_process.exec` or raw Docker exec for agents requiring TTY — they need the full PTY infrastructure for bidirectional conversational I/O.
* **Scoring**: The E-Score is the primary metric. Any change to the scoring logic must be reflected in `Feature 4.3` of the Roadmap.

## 7. System Integration & Pre-Flight Verification

This section defines what "integration complete" means at each review level. Reviewers MUST use these criteria to evaluate readiness — not just spec compliance.

### 7.1. Integration Contracts Between Modules

Each module must be reachable and consumable by its upstream dependents:

| Module | Produces | Consumed By | Integration Check |
|--------|----------|-------------|-------------------|
| **Miner** | Candidates (SQLite) | Evaluator, Session, Judge | `repobench mine` must be invocable; candidates must persist to `repobench.db`. |
| **Sandbox** | Docker containers / simulation | Session, Judge | `SandboxConfig` must support agent tool installation; container must have repo checked out. |
| **Session** | Agent interaction logs | Judge | Agent adapters must be registered in CLI; startup command must succeed inside container. |
| **Judge** | Run results (SQLite) | Report | `repobench run-all` and `repobench evaluate` must complete without crashing. |
| **Report** | Leaderboard table | User | `repobench report` must render a table; `export-failures` must produce artifact files. |

### 7.2. CLI Command Inventory

All user-facing commands must be registered in `src/cli/index.ts` and invocable:
- `repobench mine` — Must exist. Accepts `-r <path>` and `-c <config>`.
- `repobench export <path>` / `repobench import <path>` — Dataset portability.
- `repobench evaluate` — Run evaluation pipeline.
- `repobench run-all` — Batch agent evaluation.
- `repobench report` — Leaderboard view.
- `repobench export-failures` — Failure artifact export.

### 7.3. Required Configuration Files

For any target repository, the following must exist or have fallbacks:
- `repobench.yaml` — Mining keywords, sandbox config (build/test commands, base image, agent setup commands).

### 7.4. Pre-Flight Checklist (Final MVP Review)

Before an epic or the full MVP can be marked `[x]`, verify:
1. **CLI completeness**: All commands listed in §7.2 are registered in `src/cli/index.ts` and display via `--help`.
2. **Config existence**: `repobench.yaml` exists for the target repo (or a template/fallback is documented).
3. **Tool installation**: Agent dependencies (`agentSetupCommands`) can be installed inside the sandbox container.
4. **End-to-end flow**: The pipeline `mine → evaluate → run-all → report → export-failures` can be invoked without crashes (individual runs may fail for valid reasons, but the system must not crash).
5. **Error surface**: All errors produce actionable messages (no silent `catch {}` blocks, no unhelpful stack traces to end users).
6. **Regression**: `npm run typecheck && npm run lint && npm test` passes.

Reviewers MUST execute or simulate each step, not just read code. If any check fails, the epic/MVP is NOT ready and the reviewer must create remediation tasks following the FIXN pattern.

## 8. Testing Principles
To ensure deterministic benchmarks and reliable CI, all tests must adhere to these principles:

### 8.1. Test Execution
* **Strict Isolation**: Tests must not rely on or mutate shared static state. Any static state (e.g., simulation caches) must be explicitly reset in `beforeEach`.
* **DI-Driven Mocking**: Use Dependency Injection to provide mocks. Prefer injecting mock implementations of interfaces (e.g., `IDocker`) over mocking global modules.
* **State-Aware Expectations**: Distinguish between instance-level state (e.g., performance stats) and process-wide state (e.g., simulated volumes) in assertions.
* **Explicit Environment**: Use temporary directories for all file-based tests. Never rely on the existence of files in the workspace.
* **No "Hope-based" Testing**: Mocking should be precise. Avoid broad mocks that return generic success; use specific setup helpers to define expected behaviors.

### 8.2. Organization & Maintenance
* **Functional Grouping**: Do not create a new test file for every bug fix (e.g., avoid `feature-fix1.test.ts`). Group tests by functional domain (e.g., `sandbox-core.test.ts`, `volume-manager-stats.test.ts`).
* **Fixture-Based Setup**: Use centralized fixtures (e.g., `tests/infrastructure/fixtures.ts`) to reduce boilerplate and ensure consistent setup across the suite.
* **Regression Integration**: When fixing a bug, add the regression test to the existing relevant feature suite rather than creating isolated "fix" files.
