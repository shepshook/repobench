# Task 2.5.2: Implement Agent Dependency Installation in Sandbox Init

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)
**Feature:** 2.5 — Agent Tool Dependency Installation
**Status:** Not Started

---

## Objective
Execute the `agentSetupCommands` in the sandbox container during `initDocker()`, immediately after the `buildCommand` succeeds.

## Context
- `Sandbox.initDocker()` in `src/infrastructure/sandbox.ts` runs `buildCommand` at lines 187-197.
- The new `agentSetupCommands` field was added to `SandboxConfig` in Task 2.5.1.
- Agent setup commands (e.g., `npm install -g opencode`) must run inside the container where they have access to the container's package manager and network.
- The `runDockerCommand` method (or `execute`) is available to run commands inside the container.

## Instructions

### Step 1 — Add agent setup execution in `Sandbox.initDocker()`
In `src/infrastructure/sandbox.ts`, after the `buildCommand` section (after line 197), add:

```typescript
if (this.config.agentSetupCommands && this.config.agentSetupCommands.length > 0) {
  for (const cmd of this.config.agentSetupCommands) {
    console.log(`[AgentSetup] Running: ${cmd}`);
    const result = await this.runDockerCommand(cmd);
    if (result.exitCode !== 0) {
      const setupError = Object.assign(
        new Error(`Agent setup command failed: ${cmd}`),
        { stdout: result.stdout, stderr: result.stderr }
      );
      throw setupError;
    }
  }
}
```

### Step 2 — Handle simulation mode
In `Sandbox.initSimulation()`, add a similar block that logs simulated setup commands without executing them:

```typescript
if (this.config.agentSetupCommands) {
  for (const cmd of this.config.agentSetupCommands) {
    console.log(`[AgentSetup][Simulation] Skipping: ${cmd}`);
  }
}
```

### Step 3 — Update `repobench.yaml` (if applicable)
If this is the RepoBench repo itself, add to `repobench.yaml`:
```yaml
sandbox:
  agent_setup_commands:
    - npm install -g opencode
```

### Step 4 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Run `npm test -- --run tests/infrastructure/sandbox.test.ts` — must pass.
- Run `npm test -- --run tests/infrastructure/volume-manager.test.ts` — must pass.

## Acceptance Criteria
1. `agentSetupCommands` are executed sequentially inside the Docker container after `buildCommand`.
2. If any `agentSetupCommands` command exits with non-zero, the sandbox init fails with a descriptive error including stdout/stderr.
3. Simulation mode logs setup commands without executing them.
4. Typecheck and lint pass.
5. All sandbox and volume-manager tests pass.
