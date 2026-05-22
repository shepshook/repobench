# Task 5.2.FIX3: Fix batch-runner-di.test.ts Mock Exec Not Invoking Tasks

## Context
- **File**: `tests/core/services/batch-runner-di.test.ts`
- **Root Cause**: The mock `IWorkerPool.exec` returns `[]` (via `mockResolvedValue([])`) without executing any task functions. The test "should NOT use hardcoded fallbacks when invalid agentConfigs are provided" expects `runAll()` to reject with `'Agent configuration not found'`, but the mock worker pool never calls the task `fn()`, so the agent config lookup path is never triggered. Additionally, `{} as any` is passed for `agentConfigs`, which would cause `TypeError: this.agentConfigs.find is not a function` at runtime rather than the expected controlled error.

## Technical Directive
Fix the test in `tests/core/services/batch-runner-di.test.ts`:

1. **Fix the `mockWorkerPool.exec` mock** (line 6): Change from `mockResolvedValue([])` to a proper implementation that actually executes task functions:
   ```typescript
   const mockWorkerPool = {
     exec: vi.fn().mockImplementation(async (tasks) => {
       const results = [];
       for (const task of tasks) {
         try {
           const value = await task.fn();
           results.push({ id: task.id, status: 'fulfilled', value });
         } catch (error) {
           results.push({ id: task.id, status: 'rejected', error });
         }
       }
       return results;
     }),
     getActiveCount: vi.fn(),
     shutdown: vi.fn().mockResolvedValue(undefined),
   };
   ```

2. **Fix `agentConfigs` parameter** (line 27): Change `{} as any` to `[]` (empty array) so the controlled error path is triggered:
   ```typescript
   [] as any, // Empty agentConfigs — triggers "Agent configuration not found"
   ```

   With `[]`, `this.agentConfigs.find(a => a.agentId === agentId)` returns `undefined`, and the controlled `throw new Error('Agent configuration not found for ...')` is triggered instead of an uncontrolled `TypeError`.

3. **Update expected error message** (line 53): Change the assertion to match the exact error:
   ```typescript
   await expect(service.runAll(config)).rejects.toThrow('Agent configuration not found for agent-1');
   ```

## Verification
```bash
npx vitest run tests/core/services/batch-runner-di.test.ts
npm run typecheck && npm run lint
```
Ensure all Feature 5.2 tests still pass:
```bash
npx vitest run tests/core/services/batch-runner.test.ts tests/core/batch-contracts.test.ts tests/infrastructure/services/worker-pool.test.ts tests/core/services/batch-progress-reporter.test.ts tests/integration/run-all-cli.test.ts
```
