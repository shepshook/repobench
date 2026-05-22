# Task 5.2.FIX2: Fix BatchContractsTest Incorrect Assertions

## Context
- **File**: `tests/core/batch-contracts.test.ts`
- **Root Cause**: Two test cases assert validation rules that don't exist in `BatchConfigSchema`:
  1. **Line 52-58**: "should throw an error if timeoutPerRun is too low" — passes `timeoutPerRun: 59999` and expects `.toThrow()`, but the schema only specifies `z.number().int().default(300_000)` with no `.min()` constraint. 59999 is valid.
  2. **Line 61-67**: "should throw an error for invalid UUIDs in candidateIds" — passes `candidateIds: ['not-a-uuid']` and expects `.toThrow()`, but the schema uses `z.array(z.string()).optional()` with no UUID validation.
- These tests were written based on an earlier draft spec that expected stricter validation. The shipped schema matches the actual spec.

## Technical Directive
Fix two tests to match the actual schema behavior:

1. **"should throw an error if timeoutPerRun is too low"** (line 52-58):
   - Change the assertion to expect **no throw** (the value is valid), OR update the test to use a genuinely invalid value like `-1` and update the schema accordingly.
   - Preferred approach: change `expect(() => ...).toThrow()` to `expect(() => ...).not.toThrow()` since the schema does not enforce a minimum.

2. **"should throw an error for invalid UUIDs in candidateIds"** (line 61-67):
   - Change the assertion to expect **no throw** (strings are valid for `z.string()`), OR add `.uuid()` refinement to the schema.
   - Preferred approach: change `expect(() => ...).toThrow()` to `expect(() => ...).not.toThrow()` since the spec does not require UUID validation.

## DoD
- `npm run typecheck && npm run lint` pass.
- `npx vitest run tests/core/batch-contracts.test.ts` — all 12 tests pass.
