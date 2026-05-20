# Task 3.2.FIX1: Audit and Fix PtySession Adapter Compatibility

## Problem
`PtySession.create` was refactored to require `IAgentAdapter`, but existing infrastructure tests call `PtySession.create(sandbox)` without an adapter, causing runtime `TypeError: Cannot read properties of undefined (reading 'getStartupCommand')`.

## Objective
1. Modify `PtySession.create` to make the `adapter` parameter optional.
2. If `adapter` is not provided, use `DefaultAdapter` from `src/core/services/base-agent-adapter.ts`.
3. Update `PtySession` to ensure `this.adapter` is never undefined.
4. Run all infrastructure tests to verify the fix.

## Implementation Steps
1. Edit `src/infrastructure/pty-session.ts` to update `PtySession.create` signature.
2. Import `DefaultAdapter`.
3. Default `adapter` to `new DefaultAdapter()` if not provided.
4. Re-run `npm test` to ensure all tests pass.
