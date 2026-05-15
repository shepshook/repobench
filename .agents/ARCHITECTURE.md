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

* **No Silent Failures**: Always wrap I/O (Docker, Git, PTY) in `try/catch` blocks.
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
* **PTY**: Use `node-pty` for real-time interaction. Do not use standard `child_process.exec` for agents requiring TTY.
* **Scoring**: The E-Score is the primary metric. Any change to the scoring logic must be reflected in `Feature 4.3` of the Roadmap.
