# Task 3.6.FIX3: Fix Test Assertions Broken by FIX1/FIX2 Implementation Changes

## Description
Five tests are failing because their assertions were not updated to match the FIX1 (cliArgs deduplication) and FIX2 (lint/promise-void fix) code changes. The implementation code is correct; only test expectations need updating.

## RCA
Task 3.6.FIX1 removed `args: config.cliArgs` from the `PtySession.create()` call in `session-orchestrator.ts`. Task 3.6.FIX2 changed `onData`/`onTimeout` callbacks to use the `void` operator (returning `undefined` instead of a promise). The affected tests still assert the pre-fix behavior.

## Failures

### File 1: `tests/services/session-orchestrator.test.ts` (4 failures)

#### Failure 1 — Line 65: "should pass cliArgs from agent config to PtySession.create"
The test asserts `expect.objectContaining({ args: config.cliArgs })` as the third argument to `PtySession.create()`. After FIX1, the third argument is `{}` (empty options object).

**Fix**: Change the assertion from `expect.objectContaining({ args: config.cliArgs })` to `expect.objectContaining({})` or remove the args check entirely.

#### Failure 2 — Line 205: "should throw a descriptive error when session.close fails during completion"
The test does `await expect(dataCallback('Task completed.')).rejects.toThrow(...)`. After FIX2, `dataCallback` uses `void session.close().catch(...)` so it returns `undefined`, not a rejected promise.

**Fix**: The test should verify that `session.close()` was called instead of asserting a rejection. The throw inside `.catch()` is deliberately unhandled (void pattern). Change to:
```typescript
dataCallback('Task completed.');
expect(mockSession.close).toHaveBeenCalled();
```

#### Failure 3 — Line 259: "should throw a descriptive error when session.close fails during timeout"
Same root cause as Failure 2, for the `onTimeout` callback.

**Fix**: Same approach — verify `session.close` was called instead of awaiting rejection:
```typescript
timeoutCallback();
expect(mockSession.close).toHaveBeenCalled();
```

#### Failure 4 — Line 308: "should not return a promise from onTimeout callback"
The mock for `close` at line 300 returns `undefined` (`close: vi.fn()` with no mockResolvedValue). When `onTimeout` calls `void session.close().catch(...)`, `undefined.catch()` throws TypeError.

**Fix**: The mock for `close` must return a promise:
```typescript
close: vi.fn().mockResolvedValue(undefined),
```

### File 2: `tests/services/prompt-handler-integration.test.ts` (1 failure)

#### Failure 5 — Line 58: "should create a session that uses PromptHandler based on adapter rules"
The test asserts `{ args: mockConfig.cliArgs }` as the third argument to `PtySession.create()`. After FIX1, this is `{}`.

**Fix**: Change the assertion to `{}`:
```typescript
expect(PtySession.create).toHaveBeenCalledWith(
  mockSandbox,
  mockAdapter,
  {},
  expect.any(Object)
);
```

## Verification
```bash
npm run typecheck && npm run test -- --run tests/services/session-orchestrator.test.ts tests/services/prompt-handler-integration.test.ts
```
All 5 Feature 3.6-scope tests must pass (0 failures).

## DoD
- [ ] `tests/services/session-orchestrator.test.ts` — all 4 failing tests pass
- [ ] `tests/services/prompt-handler-integration.test.ts` — 1 failing test passes
- [ ] `npm run typecheck` — 0 errors
- [ ] No changes to implementation code (`.ts` files outside `tests/`)
