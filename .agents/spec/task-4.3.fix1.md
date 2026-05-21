# Task 4.3.FIX1: Fix contracts.test.ts Parse Error — Dangling `});` and Orphaned it() Calls

## Description
Commit `d4b7de9` (Task 4.3.1) introduced a critical syntax error in `tests/core/contracts.test.ts`. The `describe('ValidationResultSchema')` block was prematurely closed after the first `it()` test to insert a new `describe('IScorer')` block. However, two existing `it()` calls (invalid enum value tests) and the original closing `});` were left orphaned at lines 38–63, causing the OXC/Vite parser to fail with "Unexpected token" at line 63.

## Root Cause
The diff in `d4b7de9` removed the `it('should throw an error for missing required fields')` test and the inner `describe('ValidationResultSchema')` closing was inserted early (`});` at line 16). The remaining two `it()` tests + the original `});` closing bracket became orphaned outside any `describe` block, producing invalid JavaScript/TypeScript.

## Fix Applied
The orphaned `it()` calls were moved back inside the `describe('ValidationResultSchema')` block. The dangling `});` at line 63 and the extra blank lines were removed. The `describe('IScorer')` block remains correctly placed after `ValidationResultSchema`.

## Verification
- Ensure `npm run typecheck` passes.
- Ensure `npx vitest run tests/core/contracts.test.ts` passes all tests (3 `ValidationResultSchema` tests + 1 `IScorer` test).
- Ensure all Feature 4.3 E-Score tests still pass:
  - `tests/core/services/e-score-service.test.ts`
  - `tests/core/services/e-score-service-regression.test.ts`
  - `tests/core/services/evaluator-escore-integration.test.ts`
  - `tests/evaluator/e-score.test.ts`

## DoD
- `contracts.test.ts` parses successfully and all 4 tests pass.
- No regressions in E-Score test suite.
