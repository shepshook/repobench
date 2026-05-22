# Task 5.5.1: Execute Full Pipeline Against RepoBench Repository

**Epic:** 5 — Comparative Analysis & Reporting (The Leaderboard)
**Feature:** 5.5 — End-to-End Pipeline Validation
**Status:** Not Started

---

## Objective
Run the complete RepoBench pipeline against the RepoBench repository itself (dogfooding), from mining through evaluation to reporting, and document any runtime issues.

## Prerequisites
- Task 1.7.1 complete: `mine` command is registered in CLI.
- Task 1.7.2 complete: `repobench.yaml` exists.
- Task 2.5.1 complete: `agentSetupCommands` field exists in config.
- Task 2.5.2 complete: Agent dependencies install during sandbox init.
- Docker is running and `npm ci` has been run.

## Instructions

### Step 1 — Mine candidates from the RepoBench repo
```bash
node src/cli/index.js mine -r .
```
Expected: Finds bug-fix candidates from the git history. Documents the number of candidates found.

### Step 2 — Validate candidates
```bash
node src/cli/index.js evaluate --project repobench
```
Expected: Runs the evaluation pipeline on validated candidates. Documents any failures.

### Step 3 — Run agent benchmark
```bash
node src/cli/index.js run-all -a opencode --concurrency 1 --project repobench
```
Expected: Spawns sandbox, installs opencode via agent setup commands, runs agent against candidates, evaluates results. Documents all output including errors.

### Step 4 — Generate report
```bash
node src/cli/index.js report
```
Expected: Shows leaderboard with opencode scores.

### Step 5 — Export failures
```bash
node src/cli/index.js export-failures
```
Expected: Exports failure artifacts for any failed runs.

### Step 6 — Document findings
Record every error, warning, or unexpected behavior encountered in each step. This will feed into Task 5.5.2.

## Acceptance Criteria
1. `mine` command runs successfully and discovers candidates.
2. `evaluate` command runs without crashing (candidates may all be invalid — that's acceptable).
3. `run-all` command with opencode completes (even if all runs fail — the pipeline must not crash).
4. `report` command displays a leaderboard table.
5. `export-failures` command creates artifact files if failures exist.
6. All runtime issues are documented (not hidden or silenced).
