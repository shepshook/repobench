# Task 3.3.FIX3: Fix PTY injection synchronization test

## Root Cause
`tests/infrastructure/pty-session.test.ts` line 191-213 — "should synchronize injected responses with other PTY operations" — fails because `'Injected Middle'` is not found in `accumulated` (indexOf returns -1).

The root cause is a timing/ordering issue: the `injectData` handler in `pty-worker.cjs` (line 53) uses `await new Promise(resolve => setTimeout(resolve, 100))` before emitting data. Meanwhile, Docker PTY output from prior `write` operations arrives asynchronously via the `data` event on the container exec stream. This means:

1. PTY output from `write('echo "First"\n')` may arrive **after** the `injectData`'s 100ms delay fires, causing `'Injected Middle'` to appear before `'First'` in the accumulated output.
2. OR PTY output from `write('echo "First"\n')` arrives **during** the 100ms delay and gets interleaved with the injectData output before `write('echo "Last"\n')` is processed.
3. In the worst case, PTY output from both `'First'` and `'Last'` arrives **after** `waitForText(session, 'Last')` has already resolved but `'Injected Middle'` hasn't arrived yet, so it's simply missing from `accumulated`.

The fundamental problem is that the Docker driver's `write()` resolves before the PTY echo output is received (the echo comes asynchronously via the `data` event), so the queue-based ordering in `PtySession` doesn't guarantee that injected data appears between the outputs of sequential writes.

## Fix Instructions (2 files)

### 1. `src/core/contracts.ts` — No changes needed

### 2. `src/infrastructure/pty/pty-worker.cjs`

**Replace** the `injectData` case (lines 52-59):
```javascript
            case 'injectData': {
                await new Promise(resolve => setTimeout(resolve, 100));
                const data = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
                node_worker_threads_1.parentPort?.postMessage({ type: 'data', data });
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
```

**With**: Remove the artificial 100ms delay and emit data through the actual PTY driver instead of bypassing it:

```javascript
            case 'injectData': {
                if (!driver) throw new Error('PTY driver not spawned');
                const data = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
                await driver.write(data);
                if (id) {
                    node_worker_threads_1.parentPort?.postMessage({ type: 'response', id, result: true });
                }
                break;
            }
```

**Rationale**: Instead of faking data by directly posting a 'data' message to the parent (which breaks ordering since it doesn't go through the PTY echo path), write the data to the actual PTY driver. This ensures the injected response goes through the same echo/data path as normal writes, preserving output ordering. The Docker driver's `write()` sends data to the container's stdin, and the container's PTY echoes it back as stdout data — maintaining correct chronological order.

### 3. `tests/infrastructure/pty-session.test.ts`

**Update** the test assertion (lines 204-210) to use `getScreenState()` instead of `accumulated` for ordering checks, since `accumulated` is raw data callback output which may contain control characters:

```typescript
      // Use screen state for ordering checks (normalized output)
      const screenState = session.getScreenState();
      const firstIdx = screenState.indexOf('First');
      const midIdx = screenState.indexOf('Injected Middle');
      const lastIdx = screenState.indexOf('Last');

      expect(firstIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lastIdx);
```

## Verification
```bash
npx vitest run tests/infrastructure/pty-session.test.ts
```
