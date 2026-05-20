# PTY & ANSI Infrastructure Stability Plan

This document outlines the plan to stabilize the PTY infrastructure following the architectural pivot to a worker-based pipeline. 

## 1. Current State Analysis
The architectural pivot is implemented:
- **Phase 1**: `VteParser` and `VirtualScreen` are implemented.
- **Phase 2**: `PtySession` is now a proxy to a `pty-worker.cjs` thread.
- **Phase 3**: `DockerDriver` uses native Docker TTY streams.
- **Phase 4**: Infrastructure tests are migrating to `getScreenState()` and `waitForText`.

**Status**: The architecture is sound, but the system is unstable. Existing tests are failing because they were written for a synchronous, `node-pty`-direct architecture.

---

## 2. Regression Categories

### Category 1: Instantiation & Lifecycle
- **Issue**: Tests calling `new PtySession(sandbox)` crash because the worker is only created via `PtySession.create()`.
- **Root Cause**: Private constructor for `PtySession` is enforced, but tests still use the old constructor.

### Category 2: Simulation Fidelity
- **Issue**: `SimulationDriver` doesn't handle basic shell commands (`ver`, `ls`, `read`, `cd`), leading to `waitForText` timeouts.
- **Root Cause**: `SimulationDriver` is a minimal stub, but tests treat it as a shell replacement.

### Category 3: Parser Divergence (ECMA-48 vs. Legacy)
- **Issue**: `VteParser` is strictly ECMA-48 compliant, while old tests expect regex-based "incorrect" stripping for certain sequences.
- **Root Cause**: The new parser is *more* correct than the old regexes, but this breaks legacy tests.

### Category 4: RCA & Error Propagation
- **Issue**: Errors from the worker are not properly wrapped by `mapSpawnErrorToRca` in the main process.
- **Root Cause**: Worker catches errors but sends back only `.message`, and the main process doesn't always map these results correctly.

### Category 5: IPC & Worker Stability
- **Issue**: Occasional timeouts and `Worker exited unexpectedly` errors.
- **Root Cause**: Mixed use of CJS/TS in workers and potential unhandled promises in the IPC loop.

---

## 3. Refined Implementation Strategy (Consultation Results)

### SimulationDriver: The "Targeted Registry" Approach
Instead of a full shell emulator, we will implement a **Command Registry**.
- **Registry**: A map of command names (e.g., `echo`, `pwd`, `read`) to simple handler functions.
- **State**: Maintain `cwd` and `env` variables inside the driver.
- **Scope**: Only implement commands explicitly used in the test suite.
- **Interactive Mode**: Maintain a `waitingForInput` state to support `read` commands.

### VteParser: Correctness over Legacy
- **Decision**: Keep `VteParser` strictly ECMA-48 compliant.
- **Action**: Update the tests to match correct terminal behavior. Do not degrade the parser to match incorrect regex behavior.

### RCA Handling: Utility Extraction
- **Action**: Extract `mapSpawnErrorToRca` into a pure utility function (`rca-utils.ts`).
- **Action**: Test this utility in isolation.
- **Action**: Fix worker error propagation to send `error?.message ?? String(error)`.

---

## 4. Execution Roadmap

### Step 1: Foundations & Error Handling
- [x] Extract `mapSpawnErrorToRca` to `src/infrastructure/pty/rca-utils.ts`.
- [x] Implement unit tests for `rca-utils.ts`.
- [x] Fix worker error propagation in `pty-worker.cjs` and `pty-session.ts`.
- [x] Add structured worker-level error reporting.

### Step 2: Simulation Driver Enhancement
- [x] Implement Command Registry in `SimulationDriver`.
- [x] Add handlers for: `echo`, `read`, `pwd`, `cd`, `mkdir`, `ver`, `uname`, `ls`/`dir`, `cat`/`type`.
- [x] Implement `cwd` and `env` state tracking.
- [x] Sync `.ts` and `.cjs` implementations.

### Step 3: Test Suite Migration
- [x] Update all tests to use `PtySession.create()`.
- [x] Update `pty-ansi-parser.test.ts` expectations to match ECMA-48 correctness.
- [x] Rewrite RCA tests to use the new `rca-utils.ts` instead of mocking `node-pty`.
- [x] Verify interactive input tests in `pty-session.test.ts`.

### Step 4: Final Verification & Stress Testing
- [x] Run all infrastructure tests.
- [x] Perform stress tests with rapid spawn/close cycles.
- [x] Final `npm run typecheck`.

---

## 5. Dual-Path Execution Model

During stabilization, a critical architectural refinement emerged: `sandbox.execute()` now uses direct `docker.exec` for batch/infrastructure commands, while `PtySession.create()` is reserved for interactive agent TTY sessions.

### Rationale
- **Batch commands** (git, build, test) need clean stdout/stderr, direct exit codes, and low overhead — Docker's native exec API provides this.
- **Agent sessions** need bidirectional TTY I/O, ANSI parsing, and stateful interaction — the worker-based PtySession provides this.
- Attempting to route all commands through a PTY adds unnecessary complexity, latency, and failure modes for non-interactive operations.

### Implications
- `ARCHITECTURE.md §6` updated to document the split.
- `ROADMAP.md Feature 3.1` updated with the dual-path note.
- All 9 FIX tasks (3.1.FIX1-FIX9) are completed or superseded.
- The PTY path remains fully available for Epic 3 (agent sessions).
