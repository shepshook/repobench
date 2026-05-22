# Task 5.FIX1.1: Wire Missing IFailureArtifactExporter Implementation & Reconcile RegressionStatus Enum

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX1 — Global Epic Integration & Alignment Round 1
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Formally bind `FailureArtifactExporter` to the `IFailureArtifactExporter` contract defined in `contracts.ts`, and reconcile the `regressionStatus` enum in `FailureArtifactSchema` so that it only contains values actually emitted by the exporter.

## Context
- `src/core/contracts.ts` lines 529–532 define `IFailureArtifactExporter` with `exportForRun()` and `exportAllFailures()`.
- `src/infrastructure/failure-artifact-exporter.ts` line 10 declares `export class FailureArtifactExporter {` — **missing** `implements IFailureArtifactExporter`.
- The `FailureArtifactSchema` (contracts.ts:515) defines `regressionStatus: z.enum(['clean', 'regressed', 'error'])`, but `FailureArtifactExporter` line 97 always returns `'regressed'` or `'error'` — never `'clean'`. Since the method throws for successful runs (`metrics.success === true`), the `'clean'` value is dead in this context.

## Instructions

### Step 1 — Add `implements` clause
In `src/infrastructure/failure-artifact-exporter.ts`, change the class declaration from:
```ts
export class FailureArtifactExporter {
```
to:
```ts
export class FailureArtifactExporter implements IFailureArtifactExporter {
```

### Step 2 — Remove `'clean'` from `regressionStatus` enum
In `src/core/contracts.ts`, change `FailureArtifactSchema`:
```ts
regressionStatus: z.enum(['clean', 'regressed', 'error']),
```
to:
```ts
regressionStatus: z.enum(['regressed', 'error']),
```

Rationale: `FailureArtifact` is only produced for failed runs. A `'clean'` run never reaches artifact export (the method throws). The schema should reflect the domain reality.

### Step 3 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/infrastructure/failure-artifact-exporter.test.ts` — all tests must pass.
- Run `npx vitest run tests/integration/export-failures-cli.test.ts` — all tests must pass.

## Acceptance Criteria
1. `FailureArtifactExporter` class declaration includes `implements IFailureArtifactExporter`.
2. `FailureArtifactSchema.regressionStatus` only contains `['regressed', 'error']`.
3. TypeScript typechecks cleanly.
4. All existing tests pass without modification.
