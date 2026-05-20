# Task 3.3.FIX2: Fix PromptHandler integration test sandbox initialization

## Root Cause
`tests/services/prompt-handler-integration.test.ts` line 20 creates `mockSandbox = new Sandbox({} as any)` — a real `Sandbox` instance without calling `init()`. `SessionOrchestrator.createSession` calls `sandbox.createSnapshot()` (line 9 of `session-orchestrator.ts`), which checks `this.initialized` and throws `'Sandbox not initialized'`.

## Fix Instructions

### 1. `tests/services/prompt-handler-integration.test.ts`

**Option A (preferred — use mock sandbox):**

Replace `vi.mock('../../infrastructure/sandbox');` (line 9) with proper mock setup.

**Replace** lines 17-28:
```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    mockSandbox = new Sandbox({} as any);
    mockConfig = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: ['--verbose'],
    };
  });
```

**With** a fully mocked Sandbox:
```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new SessionOrchestrator();
    mockSandbox = {
      createSnapshot: vi.fn().mockResolvedValue(undefined),
      restoreSnapshot: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
      destroy: vi.fn().mockResolvedValue(undefined),
      id: 'mock-sandbox',
      config: {},
      getContainer: vi.fn().mockReturnValue({ id: 'mock-container' }),
      isSimulation: false,
      registerSession: vi.fn(),
      unregisterSession: vi.fn(),
    } as unknown as Sandbox;
    mockConfig = {
      agentId: 'test-agent',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'You are a helper',
      cliArgs: ['--verbose'],
    };
  });
```

**Also remove** the unused `Sandbox` and `VolumeManager` imports if the mock approach is used — but keep the type import for the cast.

**Note:** The `vi.mock('../../infrastructure/sandbox')` on line 9 should also be removed if the mock is inline, since we're creating an inline mock object.

## Audit Feedback Round 1
- **FAIL**: The requirement to remove `vi.mock` for the Sandbox infrastructure was not met. The instruction explicitly stated: "Note: The `vi.mock('../../infrastructure/sandbox')` on line 9 should also be removed if the mock is inline". Line 9 in `tests/services/prompt-handler-integration.test.ts` still contains `vi.mock('../../src/infrastructure/sandbox');`. Please remove this line to adhere to the spec.

