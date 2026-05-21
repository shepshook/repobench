# Task 3.6.FIX4: Create agents.example.yaml Reference File

## Description
The `agents.yaml` schema and `AgentConfigLoader` are implemented, but no actual `agents.yaml` file (or example) exists anywhere in the repository. A user has no reference format to follow. The DoD in ROADMAP states "Experiments are 100% reproducible via YAML config files" — without a reference file, this is unmet.

## Requirements

### 1. Create `agents.example.yaml` at project root

Create a well-documented example file demonstrating all supported fields:

```yaml
# Agent configuration for RepoBench interactive sessions
# Each entry defines an agent that can be used with `repobench run`

agents:
  - agentId: aider
    model: gpt-4o
    temperature: 0.2
    systemPrompt: |
      You are an expert software engineer. Make minimal, targeted fixes.
    max_tokens: 4096
    cliArgs:
      - --no-suggestions
      - --yes
    completionSignatures:
      - "Task completed"
      - "All tests pass"

  - agentId: claude-code
    model: claude-sonnet-4
    temperature: 0.1
    systemPrompt: |
      You are a careful engineer. Verify before applying changes.
    cliArgs:
      - --no-autoconfirm
```

### 2. Update `AgentConfigLoader` with default path

In `src/core/services/agent-config-loader.ts`, add a default `configPath` so that loading from a well-known location works without manual path injection:

```typescript
export class AgentConfigLoader {
    constructor(private configPath: string = './agents.yaml') {}
    // ... rest stays the same
}
```

If the file does not exist at the default path, return an empty array (rather than throwing), matching the existing behavior for empty files.

### 3. Verify

```bash
npm run typecheck
npm run test -- --run tests/core/services/agent-config-loader.test.ts tests/core/services/agent-adapter-factory.test.ts tests/services/session-orchestrator.test.ts tests/infrastructure/pty-session-config.test.ts
```

## Files to modify
- `D:\dev\RepoBench\agents.example.yaml` — **CREATE**
- `D:\dev\RepoBench\src\core\services\agent-config-loader.ts` — **MODIFY** (add default path)

## Audit Feedback Round 1

- **Spec Deviation**: The spec requested an `agents:` top-level key in `agents.example.yaml`, but the implementation uses a top-level array. While the implementation aligns with `AgentConfigLoader`, it contradicts the provided spec example.
- **Incomplete Demonstration**: The example entry for `aider` in `agents.example.yaml` fails to demonstrate the `max_tokens` field, violating the requirement to demonstrate all 7 supported `AgentConfig` fields.
## Audit Feedback Round 2

- **Type Checking Failure**: The implementation in `src/core/services/agent-config-loader.ts` fails type checking (`npm run typecheck`). Specifically, `parsed` is treated as `unknown`, and map parameters `config` and `index` implicitly have `any` types.

## ESCALATION DIRECTIVE

### Root Cause
`agent-config-loader.ts:33` — After the `if` block that reassigns `parsed`, TypeScript's control-flow analysis no longer narrows `parsed` to an array (its declared type is `let parsed: unknown`). Calling `.map()` on `unknown` produces 3 type errors.

### Precise Fix

**File**: `src/core/services/agent-config-loader.ts`

1. On line 27, change `parsed = (parsed as any).agents;` to:
   ```typescript
   parsed = (parsed as Record<string, unknown>).agents as unknown[];
   ```

2. On line 33, change `return parsed.map((config, index) => {` to:
   ```typescript
   return (parsed as unknown[]).map((config, index) => {
   ```

This eliminates all `any` and `unknown` type errors by explicitly narrowing at the call site.

### Verification
```bash
npm run typecheck
npm run test -- --run tests/core/services/agent-config-loader.test.ts tests/core/services/agent-adapter-factory.test.ts tests/services/session-orchestrator.test.ts tests/infrastructure/pty-session-config.test.ts
```

### Escalation Rule
After fixing the 3 type errors, update ROADMAP.md to mark Task 3.6.FIX4 as `[x]`. Do not open another audit round unless the verification command fails. 

