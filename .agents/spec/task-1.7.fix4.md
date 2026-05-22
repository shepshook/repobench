# Task 1.7.FIX4: Fix Lint Regression — Remove Unused _writtenCommands Parameter

**Epic:** 1 — Git-Based Benchmark Generation (The Miner)
**Feature:** 1.7 — CLI Integration & Config Readiness
**Status:** Not Started

---

## Objective
Fix the lint regression introduced by the Feature 1.7 implementation. The `_writtenCommands` parameter in `ansi-processor.ts:31` is assigned but never used, causing a `@typescript-eslint/no-unused-vars` error.

## Context
- `src/infrastructure/ansi-processor.ts:31` defines a static method `normalize` with signature:
  ```typescript
  public static normalize(data: string, keepAnsi: boolean = false, _writtenCommands: string[] = []): string
  ```
- The third parameter `_writtenCommands` has an underscore prefix (indicating intentional unused), but ESLint's `@typescript-eslint/no-unused-vars` rule still flags it because the value is never read — only assigned. A previous loop body that consumed `writtenCommands` was removed.
- Two call sites pass the third argument:
  - `src/infrastructure/pty-session.ts:162`: `AnsiProcessor.normalize(output, isBehavior, this.writtenCommands)`
  - `src/infrastructure/pty-session.ts:322` (static `PtySession.normalize`): `AnsiProcessor.normalize(data, keepAnsi, writtenCommands)`

## Instructions

### Step 1 — Remove the unused parameter from AnsiProcessor
In `src/infrastructure/ansi-processor.ts:31`, remove the `_writtenCommands` parameter:

**Before:**
```typescript
public static normalize(data: string, keepAnsi: boolean = false, _writtenCommands: string[] = []): string {
```

**After:**
```typescript
public static normalize(data: string, keepAnsi: boolean = false): string {
```

### Step 2 — Update PtySession.normalize static wrapper
In `src/infrastructure/pty-session.ts:321`, remove the `writtenCommands` parameter:

**Before:**
```typescript
public static normalize(data: string, keepAnsi: boolean = false, writtenCommands: string[] = []): string {
  return AnsiProcessor.normalize(data, keepAnsi, writtenCommands);
}
```

**After:**
```typescript
public static normalize(data: string, keepAnsi: boolean = false): string {
  return AnsiProcessor.normalize(data, keepAnsi);
}
```

### Step 3 — Update call site in PtySession data handler
In `src/infrastructure/pty-session.ts:162`, change:
```typescript
const normalized = AnsiProcessor.normalize(output, isBehavior, this.writtenCommands);
```
to:
```typescript
const normalized = AnsiProcessor.normalize(output, isBehavior);
```

### Step 4 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass (specifically, the `ansi-processor.ts` error must be gone).
- Run `npm test` — all tests must pass.

## Acceptance Criteria
1. The `_writtenCommands` parameter is removed from `AnsiProcessor.normalize()`.
2. The `writtenCommands` parameter is removed from `PtySession.normalize()`.
3. Both call sites in `pty-session.ts` pass only 2 arguments to `AnsiProcessor.normalize()`.
4. `npm run lint` produces zero errors.
5. Typecheck and full test suite pass.
