# Task 3.1.2: Implement PtySession Service

## Goal
Implement the `PtySession` class that manages the PTY lifecycle, including spawning the process, handling I/O streams, and providing methods for writing commands and reading output.

## Requirements
- Implement `PtySession` class based on `IPtySession`.
- **Polymorphic Spawn Target**: Support both Docker and Simulation modes:
  - **Real Mode**: Spawn via `docker exec -it <container_id> /bin/sh` (or similar).
  - **Simulation Mode**: Spawn the host's default shell (e.g., `cmd.exe` on Windows).
- **Normalization Layer**: Implement mechanisms to strip or normalize terminal-specific noise (e.g., ANSI escape sequences, Docker-specific prompts) so the `AgentAdapter` receives clean, consistent output.
- **Robust Cleanup**: Implement a `close()` method that ensures the underlying PTY process is terminated gracefully to avoid orphaned processes or `AttachConsole` errors on Windows.
- Implement robust read/write stream handling.

## DoD
- `PtySession` class implemented.
- Unit tests verify lifecycle management (spawn/close) for both Docker and Simulation modes.
- I/O streams correctly map to `stdout`/`stderr` and output is normalized.

## Audit Feedback Round 1
- **Normalization Failure**: The `onData` event handler currently emits raw data, failing to provide the clean, consistent output required by `AgentAdapter`. The `static normalize` method is unused in the event flow.
- **Incomplete Normalization**: The `normalize` implementation does not strip "Docker-specific prompts" (e.g., container shell prompts) as explicitly required.
- **Simulation Spawn Consistency**: The simulation mode currently uses `sh.exe` for Windows, whereas the requirement specifies `cmd.exe`.

## Audit Feedback Round 2
- **Type Checking Failures**: The implementation of `PtySession` failed `npm run typecheck` with multiple errors, including incorrect typing for `pty.PtyProcess` and improper handling of nullable types in `spawn`.
- **General Type Safety**: Several type errors were identified in `pty-session.ts` and `sandbox.ts` that indicate incomplete type implementation or violation of strict null checks.

## Audit Feedback Round 3
- **Type Checking Failures**: The implementation of `PtySession` and `Sandbox` fails `npm run typecheck` with persistent errors:
  - `src/infrastructure/pty-session.ts`: 
    - `node-pty` does not export `PtyProcess`.
    - `cwd` option in `pty.spawn` receives `null` (from `sandbox.simulationDir`), but expects `string | undefined`.
    - `onData` parameter `data` is implicitly `any`.
  - `src/infrastructure/sandbox.ts`: Multiple occurrences of passing `string | null` to methods expecting `string`.
- **Action Required**: Fix all type checking errors to ensure strict null safety and correct import types.

