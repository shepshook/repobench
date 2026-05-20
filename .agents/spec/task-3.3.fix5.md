# Task 3.3.FIX5: Fix PTY Sync Failure Test — Use Echo Commands for Injection

## Root Cause
`tests/infrastructure/pty-sync.test.ts` line 37 injects raw text `'Injected Middle'` via `injectResponse`. Docker exec with `Tty: true` does NOT echo stdin text back. The shell interprets `Injected Middle` as a command and outputs `sh: Injected: not found`. The test asserts `accumulated.indexOf('Injected Middle')` which returns `-1`, causing line 49 to fail: `expected -1 not to be -1`.

## Fix Instructions

### 1. `tests/infrastructure/pty-sync.test.ts` — "should fail synchronization when shell commands are slow"

**Replace** lines 35-38:
```typescript
      // Slow down the first write
      await session.write('sleep 0.5 && echo "First"\n');
      // Inject immediately
      await (session as any).injectResponse('Injected Middle');
      // Write the last one
      await session.write('echo "Last"\n');
```

**With** a valid shell command for injection that produces visible output:
```typescript
      // Slow down the first write
      await session.write('sleep 0.5 && echo "First"\n');
      // Inject immediately — use echo to produce visible output through Docker exec
      await session.injectResponse('echo "Injected Middle"');
      // Write the last one
      await session.write('echo "Last"\n');
```

### Rationale
Same root cause as Task 3.3.FIX4. `injectResponse` appends `\n` before sending (pty-session.ts:363). The payload `echo "Injected Middle"\n` is a valid shell command that produces `Injected Middle` as stdout output. Since the queue processes operations in order, the output will be: `First` → `Injected Middle` → `Last`, and all three `indexOf` assertions will pass.

Also removes the unnecessary `(session as any)` cast — `injectResponse` is on the `IPtySession` interface.

## Verification
```bash
npx vitest run tests/infrastructure/pty-sync.test.ts
```

## Audit Feedback Round 1
- **Status**: FAIL
- **Observation**: The code in `tests/infrastructure/pty-sync.test.ts` does not match the specifications defined in this file. Specifically:
  - The injection command is still `(session as any).injectResponse('Injected Middle')` instead of `session.injectResponse('echo "Injected Middle"')`.
  - The `(session as any)` type cast remains.
- **Required Actions**: Implement the changes exactly as specified in the "Fix Instructions" section.
