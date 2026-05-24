# ADR-001: Infrastructure Patterns for RepoBench

**Date:** 2026-05-23
**Status:** Adopted
**Deciders:** Architecture team

## Context

The RepoBench MVP revealed recurring infrastructure anti-patterns that caused subtle bugs, blocked the pipeline, and made testing unreliable. We identified four root causes that needed permanent solutions.

## Decisions

### 1. No Silent Degradation — Docker Required by Default

**Problem:** The sandbox silently fell back from Docker to simulation mode on any Docker error. This created divergent execution paths: tests passed in simulation but failed in production, and real Docker failures were invisible.

**Decision:** Simulation mode is only activated when `FORCE_SIMULATION=true` environment variable is set. Without it, Docker errors propagate with a clear message:

```
Docker is required for sandbox execution. Set FORCE_SIMULATION=true environment variable to use simulation mode for testing.
```

**Enforcement:** ESLint rule `no-empty` blocks empty catch blocks that could swallow errors.

**File:** `src/infrastructure/sandbox.ts:100-122`

---

### 2. Explicit Initialization — No Import Side-Effects

**Problem:** Agent adapters were registered as a side-effect of importing `src/cli/index.ts`. Any code path that used `AgentAdapterFactory.createAdapter()` without importing the CLI entry point silently got a `DefaultAdapter`. This broke tests and created fragile implicit dependencies.

**Decision:** All registrations happen inside an explicit `registerAllAdapters()` function in `src/infrastructure/agents/register-adapters.ts`. Callers must import and invoke this function directly. Tests call it in their own setup phase.

**Pattern:**
```typescript
// DO this:
import { registerAllAdapters } from '../infrastructure/agents/register-adapters';
registerAllAdapters();

// NOT this:
import '../cli/index'; // implicit side-effect registration
```

**Enforcement:** The old import pattern can be identified by unused-import lint rules. No new side-effect-only imports are permitted.

---

### 3. POSIX Paths for Docker Container Paths

**Problem:** Hardcoded `/app` paths in `createSnapshot`, `getFilesystemSnapshot`, and `switchState` assumed the workspace was always at `/app`. When combined with Windows hosts, `path.resolve()` emitted `C:\...` paths that Linux containers could not read.

**Decision:** All paths destined for inside Docker containers use `path.posix.resolve()` (not `path.resolve()`). Host-side bind-mount paths (passed to Docker's `-v` flag) use the platform-native `path.resolve()`.

**Pattern:**
```typescript
import { resolve, posix } from 'node:path';

// Host path (Docker bind mount source) — use native resolve:
const absWorkspace = resolve(this.config.workspacePath);
binds.push(`${absWorkspace}:/app`);

// Container-internal path (Docker exec command) — use posix:
private get workspaceDir(): string {
  return this.config.workspacePath
    ? posix.resolve(this.config.workspacePath)
    : '/app';
}
```

**Enforcement:** ESLint does not enforce this at compile time. Code review must verify that container-destined paths use `posix` rather than platform-native `resolve`.

---

### 4. Test Doubles via DI, Not Hardcoded Fixture Maps

**Problem:** `executeSimulation()` contained a 200-line `if/else` chain mimicking OS commands (`printenv`, `cat`, `ls`, `grep`, `mkdir`, etc.). Each new command required adding another branch. The simulation mode was also the only path for running tests without Docker.

**Decision:** `executeSimulation()` now delegates to a `SimulationFixtures` handler registry. Tests inject mock responses via `SimulationFixtures.register()`. No hardcoded command responses live in production code. Tests own their fixture data.

**Pattern:**
```typescript
// In test:
import { SimulationFixtures } from '../../src/infrastructure/sandbox';

beforeEach(() => {
  SimulationFixtures.register('printenv', async (cmd) => ({
    stdout: 'PATH=/usr/bin\nHOME=/root\n',
    stderr: '',
    exitCode: 0,
  }));
});

afterEach(() => {
  SimulationFixtures.clear();
});
```

**Enforcement:** Code review rejects any new `if (command === '...')` branches in `executeSimulation()`. The method should only contain path translation, cache translation, and delegation to either fixtures or real subprocess.

---

## Consequences

1. **Infrastructure failures are loud.** If Docker is down, the pipeline stops with a clear error. No more hours debugging simulation-vs-Docker discrepancies.

2. **Tests are explicit about their dependencies.** A test that needs adapters calls `registerAllAdapters()`. A test that needs simulation output registers fixtures. Nothing happens by accident.

3. **Windows cross-platform works.** Container-destined paths are always POSIX, preventing silent path corruption.

4. **Backward compatibility:** Existing tests that rely on simulation mode must set `FORCE_SIMULATION=true`. Existing tests that rely on the old command-handling behavior must register equivalent fixtures.

## Status of Affected Files

| File | Change |
|------|--------|
| `src/infrastructure/sandbox.ts` | Removed Docker fallback; added `workspaceDir` getter; replaced `executeSimulation` if/else chain with `SimulationFixtures`; removed `baseImagePath`; `/app` → `workspaceDir` |
| `src/cli/index.ts` | Adapter registrations moved to explicit call |
| `src/infrastructure/agents/register-adapters.ts` | New file — single source of truth for adapter registration |
| `src/core/contracts.ts` | Removed `baseImagePath` from `SandboxConfig` |
| `eslint.config.js` | Added `no-empty`, `no-restricted-globals` (`__dirname`), `no-restricted-properties` (`process.exit`) |

## Review

This ADR is effective immediately. Any future change to infrastructure patterns must be reviewed against these four decisions. Proposals to add new simulation command handlers or silent fallback paths will be rejected.
