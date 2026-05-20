# Task 3.3.FIX4: Fix PtySession Injection Synchronization Test — Use Echo Commands

## Root Cause
`tests/infrastructure/pty-session.test.ts` line 200 injects raw text `'Injected Middle'` via `injectResponse`. Docker exec with `Tty: true` does NOT echo stdin text back. The shell interprets `Injected Middle` as a command and outputs `sh: Injected: not found`. The test asserts `screenState.indexOf('Injected Middle')` which returns `-1`, causing line 211 to fail: `expected 25 to be less than -1`.

## Fix Instructions

### 1. `tests/infrastructure/pty-session.test.ts` — "should synchronize injected responses with other PTY operations"

**Replace** lines 198-201:
```typescript
      // Order: write -> inject -> write
      await session.write('echo "First"\n');
      await (session as any).injectResponse('Injected Middle');
      await session.write('echo "Last"\n');
```

**With** a valid shell command for injection that produces visible output (keep `injectResponse` to test that mechanism):
```typescript
      // Order: write -> inject -> write
      await session.write('echo "First"\n');
      await (session as any).injectResponse('echo "Injected Middle"');
      await session.write('echo "Last"\n');
```

**Also remove** the unnecessary `as any` cast on line 200 — `injectResponse` is on the `IPtySession` interface:
```typescript
      await session.injectResponse('echo "Injected Middle"');
```

### Rationale
`injectResponse` appends `\n` before sending to the worker (pty-session.ts:363). So the payload becomes `echo "Injected Middle"\n` — a valid shell command that the Docker exec shell executes, outputting `Injected Middle` as visible text. The `screenState.indexOf('Injected Middle')` assertions on lines 207-209 will then pass because the echo command produces the expected output. The ordering guarantees are preserved because the queue processes `write → injectResponse → write` sequentially.

## Verification
```bash
npx vitest run tests/infrastructure/pty-session.test.ts -t "should synchronize injected responses"
```
