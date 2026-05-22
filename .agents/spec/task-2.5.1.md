# Task 2.5.1: Add Agent Dependency Setup to SandboxConfig

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)
**Feature:** 2.5 — Agent Tool Dependency Installation
**Status:** Not Started

---

## Objective
Extend `SandboxConfig` and the `repobench.yaml` schema to support installing agent dependencies (e.g., `npm install -g opencode`) inside the sandbox container before the agent session starts.

## Context
- The current sandbox only runs `buildCommand` (for repo setup) after container creation.
- Agent tools like `opencode`, `claude-code`, or `aider` need to be available in the container for the PTY session.
- Different agents may have different tool dependencies, so the mechanism should support per-agent or per-project tool installation.
- Currently there is no mechanism to install additional tools beyond what's in the base Docker image.

## Instructions

### Step 1 — Extend `SandboxConfig` in `src/core/contracts.ts`
Add an optional `agentSetupCommands` field:

```typescript
export interface SandboxConfig {
  buildCommand?: string;
  testCommand?: string;
  envVars?: Record<string, string>;
  baseImage?: string;
  baseImagePath?: string;
  cacheVolumes?: { hostPath: string; containerPath: string }[];
  cachePaths?: string[];
  project?: string;
  agentSetupCommands?: string[];  // NEW: Commands to install agent tools (npm install -g, pip install, etc.)
}
```

### Step 2 — Extend `repobench.yaml` schema in `src/core/config.ts`
Add the `agent_setup_commands` field to the sandbox section:

```typescript
sandbox: z.object({
  build_command: z.string().optional(),
  test_command: z.string().optional(),
  env_vars: z.record(z.string()).optional(),
  base_image: z.string().optional(),
  cache_paths: z.array(z.string()).optional(),
  agent_setup_commands: z.array(z.string()).optional(),  // NEW
}).optional(),
```

Update the transform to map it:
```typescript
sandbox: data.sandbox ? {
  buildCommand: data.sandbox.build_command,
  testCommand: data.sandbox.test_command,
  envVars: data.sandbox.env_vars,
  baseImage: data.sandbox.base_image,
  cachePaths: data.sandbox.cache_paths,
  agentSetupCommands: data.sandbox.agent_setup_commands,
} : undefined,
```

### Step 3 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Run `npm test -- --run tests/core/config.test.ts` (if exists) — must pass.

## Acceptance Criteria
1. `SandboxConfig` interface in `contracts.ts` has optional `agentSetupCommands: string[]`.
2. `repobench.yaml` schema accepts `sandbox.agent_setup_commands` as a list of strings.
3. YAML-to-config transform correctly maps `agent_setup_commands` → `agentSetupCommands`.
4. Typecheck and lint pass.
