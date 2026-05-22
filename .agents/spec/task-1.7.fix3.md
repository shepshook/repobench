# Task 1.7.FIX3: Fix Candidate Status Flow — Accept pending in evaluate/run-all

**Epic:** 1 — Git-Based Benchmark Generation (The Miner)
**Feature:** 1.7 — CLI Integration & Config Readiness
**Status:** Not Started

---

## Objective
Fix the candidate status filter in `evaluate.ts` and `run-all.ts` so they accept both `'pending'` and `'validated'` candidates. Currently they filter exclusively for `status === 'validated'`, but the miner produces `status: 'pending'` (since no `BenchmarkValidator` is wired in production). This makes the evaluation pipeline unreachable — zero candidates pass the filter.

## Context
- `src/core/services/miner.ts:114` sets `status: 'pending'` on all candidates.
- `src/cli/evaluate.ts:35` filters with `c.status === 'validated'`.
- `src/cli/run-all.ts:65` (dry-run) and `run-all.ts` (actual execution path via `batchRunner.runAll`) also filter by `'validated'`.
- The `GitMiner` does accept an optional `IBenchmarkValidator` but the `mine` command never provides one.
- The `BenchmarkValidator` requires a sandbox (Docker), which is unavailable during the mining phase in the current architecture.

## Instructions

### Step 1 — Update evaluate.ts status filter
In `src/cli/evaluate.ts`, change the filter on line 35 from:
```typescript
const candidates = allCandidates.filter(c => c.status === 'validated');
```
to:
```typescript
const candidates = allCandidates.filter(c => c.status === 'validated' || c.status === 'pending');
```

### Step 2 — Update run-all.ts status filter
In `src/cli/run-all.ts`:

In the dry-run block (line 65), change:
```typescript
: candidateRepo.getAll().filter(c => c.status === 'validated');
```
to:
```typescript
: candidateRepo.getAll().filter(c => c.status === 'validated' || c.status === 'pending');
```

### Step 3 — Update batch-runner.ts status filter
In `src/core/services/batch-runner.ts`, line 75:
```typescript
candidates = this.candidateRepository.getAll().filter(c => c.status === 'validated');
```
to:
```typescript
candidates = this.candidateRepository.getAll().filter(c => c.status === 'validated' || c.status === 'pending');
```

### Step 4 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Run `npm test` — all tests must pass.

## Acceptance Criteria
1. `evaluate.ts` accepts candidates with `status === 'pending'` in addition to `'validated'`.
2. `run-all.ts` (both dry-run and execution path) accepts `'pending'` candidates.
3. `batch-runner.ts`'s internal `getAll().filter(...)` accepts `'pending'` candidates.
4. Typecheck, lint, and full test suite pass.
