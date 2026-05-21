# Task 3.6.FIX5: Fix Misaligned Test Names and Spec File Checkboxes in Feature 3.6

## Description
Two tests in `session-orchestrator.test.ts` have names that claim "should throw" but their assertions were changed in FIX2 to only check that `close()` was called (the `void` pattern means the `.catch()` throw is now an unhandled promise rejection, not a testable rejection). Additionally, DoD checkboxes in the FIX1/FIX2/FIX3 spec files were never flipped from `[ ]` to `[x]`.

## Findings

### Issue A: Misleading test names in `tests/services/session-orchestrator.test.ts`

#### Line 179: `"should throw a descriptive error when session.close fails during completion"`
The test body (lines 200-204) does not assert any throw — it just calls `dataCallback(...)` and checks `mockSession.close` was called. The actual throw inside `session.close().catch(...)` is swallowed by `void`.

**Fix**: Rename the test to `"should attempt to close session on completion"`.

#### Line 235: `"should throw a descriptive error when session.close fails during timeout"`
Same issue. The test body (lines 256-259) just calls `timeoutCallback()` and checks `close()` was called.

**Fix**: Rename the test to `"should attempt to close session on timeout"`.

### Issue B: Unchecked DoD boxes in spec files

| File | Lines | Fix |
|------|-------|-----|
| `.agents/spec/task-3.6.fix1.md` | 42-44 | Flip all `[ ]` to `[x]` |
| `.agents/spec/task-3.6.fix2.md` | 68-69 | Flip all `[ ]` to `[x]` |
| `.agents/spec/task-3.6.fix3.md` | 66-69 | Flip all `[ ]` to `[x]` |

## Verification

```bash
npm run typecheck
npm run test -- --run tests/services/session-orchestrator.test.ts
```

## Files to modify
- `D:\dev\RepoBench\tests\services\session-orchestrator.test.ts` — lines 179, 235 (rename tests)
- `D:\dev\RepoBench\.agents\spec\task-3.6.fix1.md` — lines 42-44 (check DoD boxes)
- `D:\dev\RepoBench\.agents\spec\task-3.6.fix2.md` — lines 68-69 (check DoD boxes)
- `D:\dev\RepoBench\.agents\spec\task-3.6.fix3.md` — lines 66-69 (check DoD boxes)

## DoD
- [ ] Two test names in `session-orchestrator.test.ts` accurately describe what they test (no "should throw" where no throw is asserted)
- [ ] All DoD checkboxes in FIX1/FIX2/FIX3 spec files are `[x]`
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run test -- --run tests/services/session-orchestrator.test.ts` — 0 failures
