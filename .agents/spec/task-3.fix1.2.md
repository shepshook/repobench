# Task 3.FIX1.2: Clean Up Redundant Optional Chaining & Structural Bounds

## Audit Feedback Round 1

- Task 3.FIX1.2 has not been implemented.
- `src/core/services/session-orchestrator.ts` line 35 still contains `session.onData?.((data) => {` instead of `session.onData((data) => {`.
- The following empty directories still exist in `src/`: `judge/`, `repositories/`, `sandbox/`, `session/`.


`SessionOrchestrator.createSession` uses redundant optional chaining on `session.onData?.()` at line 35 of `src/core/services/session-orchestrator.ts`. The `onData` method is a required member of `IPtySession` (defined in `src/core/contracts.ts:181`) — it is never optional. The `?.` operator masks potential interface mismatches and adds unnecessary complexity.

Additionally, the `session.onTimeout()` call at line 48 correctly uses direct invocation without optional chaining, creating an inconsistency.

## Additional Structural Issues

- Empty directories exist in `src/`: `judge/`, `repositories/`, `sandbox/`, `session/`. These were scaffolded but never populated. The `repositories/` and `sandbox/` directories duplicate paths that exist elsewhere (`src/core/repositories/`, `src/infrastructure/sandbox.ts`). Clean these up or document them for future epics.
- The `src/infrastructure/sandbox/` directory contains `sandbox-manager.ts`, which is a duplicate alternate location — verify it aligns with `src/infrastructure/sandbox-manager.ts`.

## Fix

### 3.FIX1.2a: Fix optional chaining on onData

1. Open `src/core/services/session-orchestrator.ts`
2. Change `session.onData?.((data) => {` to `session.onData((data) => {` (line 35)
3. Verify typecheck: `npm run typecheck`
4. Verify tests: `npm test`

### 3.FIX1.2b: Audit and clean empty source directories

1. Check if `src/judge/`, `src/repositories/`, `src/sandbox/`, `src/session/` contain any files
2. Remove empty directories that serve no purpose
3. Document directories reserved for future epics in ARCHITECTURE.md if needed

## Verification

- `npm run typecheck` passes
- All 63 test files pass (excluding environmental better-sqlite3 failures)
- No empty directories remain in `src/` unless intentionally reserved for Epics 4-5
