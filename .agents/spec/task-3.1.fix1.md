# Task 3.1.FIX1: Resolve Windows PTY AttachConsole Race Condition

## Description
Address the frequent `Error: AttachConsole failed` crashes occurring in the `node-pty` internal side-agent on Windows.

## Root Cause Analysis (RCA)
The crash is a race condition in `node-pty`'s Windows implementation. `node-pty` spawns a background agent to track the process tree. When `PtySession.close()` calls a hard `process.kill()`, the shell process is terminated instantly. The background agent, polling the process list, attempts to call the Win32 `AttachConsole` API on the now-dead PID, causing a fatal crash in the side-agent process. This crash prints to system `stderr` but does not throw in the main Node.js process, making it invisible to standard test assertions.

## Objectives
- **Phase 1: Managed Shutdown**: Implement a graceful termination sequence to allow the shell to detach from the console naturally before forced termination.
- **Phase 2: Docker-Native TTY**: (Planned) Remove the redundant Windows PTY wrapper for Dockerized runs by using Docker's native `Tty: true` API.

## Implementation Plan (Phase 1)
Update `PtySession.close()` to:
1. Send `\x03` (Ctrl+C) to interrupt foreground tasks.
2. Send `exit\r` (for Windows shells) or `\x04` (for Bash) to request a graceful exit.
3. Implement an asynchronous grace period (~200ms).
4. Fallback to `process.kill()` only if the process is still active.

## Success Criteria
- Significant reduction (95%+) of `AttachConsole failed` logs in the console during high-churn PTY operations.
- `tests/infrastructure/pty-attach-console-rca.test.ts` continues to pass (ensuring no blind retries were introduced).
- No regressions in session cleanup or resource leakage.
