# Task 3.6.FIX2: Fix Lint Errors in session-orchestrator.ts and agent-config-loader.ts

## Description
There are 4 lint errors in Feature 3.6 files that must be fixed before the feature can close.

## Errors

### Error 1: `src/core/services/session-orchestrator.ts:37`
`@typescript-eslint/no-misused-promises`: `session.onData?.(async (data) => {...})` returns a `Promise<void>` but `onData` expects `(data: string) => void`.
**Fix**: Wrap the async logic in a void-context wrapper or use the `void` operator.

### Error 2: `src/core/services/session-orchestrator.ts:49`
`@typescript-eslint/no-misused-promises`: `session.onTimeout(async () => {...})` returns a `Promise<void>` but `onTimeout` expects `() => void`.
**Fix**: Same pattern as Error 1 — restructure to avoid returning a promise.

### Error 3: `src/core/services/agent-config-loader.ts:20`
`@typescript-eslint/no-unsafe-assignment`: `parsed = YAML.parse(fileContent)` returns `any`.
**Fix**: Use a typed parse function or cast through Zod schema validation. The result is already validated via `AgentConfigSchema.safeParse()` on line 30, so adding a type assertion is acceptable.

### Error 4: `src/core/services/agent-config-loader.ts:22`
`preserve-caught-error`: `throw new Error(...)` without attaching the original error as `cause`.
**Fix**: Add `{ cause: e }` as the second argument to `Error` constructor.

## Fix Plan

### session-orchestrator.ts
For lines 37 and 49, change async callbacks to void-safe patterns:
```typescript
// Line 37 — onData callback
session.onData?.((data) => {
    if (this.doneDetector.isDone(data)) {
        void session.close().catch(err => {
            throw new Error(`Failed to close session on completion: ${err instanceof Error ? err.message : err}`);
        });
    }
    const response = promptHandler.handle(data);
    if (response) {
        void session.write(response + '\n');
    }
});
```

```typescript
// Line 49 — onTimeout callback
session.onTimeout(() => {
    void session.close().catch(err => {
        throw new Error(`Failed to close session on timeout: ${err instanceof Error ? err.message : err}`);
    });
});
```

### agent-config-loader.ts
```typescript
// Line 22 — preserve caught error
throw new Error(`Failed to parse agents.yaml: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
```

For the unsafe assignment (line 20), add a type annotation:
```typescript
const parsed: unknown = YAML.parse(fileContent);
```

## Verification
- `npm run lint` — must have 0 errors in `session-orchestrator.ts` and `agent-config-loader.ts`
- `npm run typecheck` — must pass (0 errors)

## DoD
- [x] No lint errors in `session-orchestrator.ts`
- [x] No lint errors in `agent-config-loader.ts`
