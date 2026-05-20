# Task 3.3.FIX1: Fix SessionOrchestrator test mock sandbox

## Root Cause
`tests/services/session-orchestrator.test.ts` line 18 creates `mockSandbox = {} as Sandbox` — an empty object cast to `Sandbox`. The `SessionOrchestrator.createSession` now calls `sandbox.createSnapshot()` (line 9 of `session-orchestrator.ts`), which doesn't exist on the mock.

## Fix Instructions

### 1. `tests/services/session-orchestrator.test.ts`

**Replace** lines 17-19:
```typescript
    orchestrator = new SessionOrchestrator();
    mockSandbox = {} as Sandbox;
```

**With** a proper mock Sandbox:
```typescript
    orchestrator = new SessionOrchestrator();
    mockSandbox = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      destroy: vi.fn().mockResolvedValue(undefined),
      id: 'mock-sandbox',
      config: {},
      getContainer: vi.fn().mockReturnValue({ id: 'mock-container' }),
      registerSession: vi.fn(),
      unregisterSession: vi.fn(),
    } as unknown as Sandbox;
```

### 2. Add imports if missing
Ensure `vi` is imported from `vitest` (already imported at line 1).

## Verification
```bash
npx vitest run tests/services/session-orchestrator.test.ts
```
