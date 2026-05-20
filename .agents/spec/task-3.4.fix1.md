# Task 3.4.FIX1: Audit IPtySession Mock Alignment Round 1

**Objective:** Add `onTimeout` method to mock `IPtySession` objects in three test files that were not updated when Feature 3.4 added `onTimeout` to the `IPtySession` interface.

**Root Cause:** Task 3.4.3 added `onTimeout` to `IPtySession` in `src/core/contracts.ts:176`. Task 3.4.4 wired it into `SessionOrchestrator.createSession` at `src/core/services/session-orchestrator.ts:44`. However, pre-existing test files from Features 3.2/3.3 create mock `IPtySession` objects without `onTimeout`, causing `TypeError: session.onTimeout is not a function`.

**Affected Files & Fixes:**

### File 1: `tests/services/prompt-handler-integration.test.ts`
- **Location:** Line 38-43, the mock object passed to `PtySession.create.mockResolvedValue`
- **Fix:** Add `onTimeout: vi.fn(),` between `onData: vi.fn(),` and `write: vi.fn(),`

### File 2: `tests/services/session-orchestration.test.ts`
- **Location:** Line 28-32, the `mockSession` object
- **Fix:** Add `onTimeout: vi.fn(),` between `write: vi.fn().mockResolvedValue(true),` and `close: vi.fn().mockResolvedValue(undefined),`
- Also add `onData: vi.fn(),` since the mock is also missing it (SessionOrchestrator calls `session.onData` at line 32)

### File 3: `tests/services/session-rollback.test.ts`
- **Location:** Line 28-32, the `mockSession` object
- **Fix:** Add `onTimeout: vi.fn(),` between `write: vi.fn(),` and `close: vi.fn(),`
- Also add `onData: vi.fn(),` since the mock is also missing it

**Verification Steps:**
1. After fixing all three files, run `npx vitest run tests/services/prompt-handler-integration.test.ts tests/services/session-orchestration.test.ts tests/services/session-rollback.test.ts`
2. Confirm all tests pass (0 failures, 0 errors)
3. Run `npm run typecheck` to confirm no type errors
4. Run `npx vitest run tests/services/session-orchestrator.test.ts tests/core/done-detector.test.ts tests/infrastructure/pty-session.test.ts` to confirm Feature 3.4 core tests still pass

**DoD:** All 4 previously failing tests pass. No regressions in Feature 3.4 core tests. Typecheck passes.
