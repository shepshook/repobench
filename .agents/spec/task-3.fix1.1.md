# Task 3.FIX1.1: Fix Double PromptHandler Invocation Leak

## Audit Finding

`PtySession.handleIncomingData` (`src/infrastructure/pty-session.ts:160`) and `SessionOrchestrator.onData` callback (`src/core/services/session-orchestrator.ts:41`) both independently call `promptHandler.handle()` on the same data chunk, causing double auto-response injection for every matched prompt.

## Root Cause

The PromptHandler is injected into PtySession (which self-handles prompts at the infrastructure layer), but SessionOrchestrator also intercepts the same data via the `onData` callback and re-invokes the same PromptHandler instance. Since the PromptHandler buffer is cleared on first match, the second invocation re-fills and matches again.

## Fix

**Remove the duplicate `promptHandler.handle()` call from `SessionOrchestrator.createSession.onData` callback.** PtySession is the canonical prompt-handling layer (it owns the PromptHandler, has direct access to the PTY stream, and processes data before normalization). The orchestrator's onData callback should only handle DoneDetector logic and timeout management.

### Steps

1. Open `src/core/services/session-orchestrator.ts`
2. In the `createSession` method, locate the `session.onData?.((data) => { ... })` block (lines 35-45)
3. Remove the `promptHandler.handle(data)` call and the associated `session.write(response + '\n')` call (lines 41-44)
4. Keep only the DoneDetector logic (lines 36-40) in the onData callback
5. Run `npm run typecheck && npm run lint` to verify no regressions
6. Run `npm test` to verify all existing tests still pass

### Expected Result

```typescript
session.onData((data) => {
    if (this.doneDetector.isDone(data)) {
        void session.close().catch(err => {
            console.error(`Failed to close session on completion: ${err instanceof Error ? err.message : err}`);
        });
    }
});
```

## Verification

- The test "should integrate PromptHandler during session creation to process PTY output" in `tests/services/session-orchestrator.test.ts` must be updated to reflect that prompt handling is now PtySession's responsibility, not the orchestrator's
- No data should be written twice for a single prompt match
- `npm test` must pass with all existing tests
