# PTY & ANSI Infrastructure Refactor Plan

## 1. Architectural Blueprint: The New Data Flow
We are transitioning from a synchronous-style proxy to an **Asynchronous Worker-based Pipeline** to eliminate event-loop starvation and regex fragility.

**New Flow:**
`Main Process` $\rightarrow$ `PtySession (Proxy)` $\rightarrow$ `IPC` $\rightarrow$ `PTY Worker (Isolated Thread)` $\rightarrow$ `Driver (Native/Docker)` $\rightarrow$ `VTE State Parser` $\rightarrow$ `Virtual Screen Buffer` $\rightarrow$ `Semantic Assertion`

---

## 2. Detailed Implementation Phases

### Phase 1: The ANSI State Machine & Virtual Buffer
*Goal: Replace the "Regex Whack-a-Mole" with a deterministic parser.*

1.  **Implement `VteParser`**:
    *   Rewrite `AnsiProcessor` as a class that maintains an internal state (e.g., `GROUND`, `ESCAPE`, `CSI`, `OSC`, `DCS`).
    *   Process data byte-by-byte according to ECMA-48.
    *   Correctly handle CSI/OSC/DCS terminators without relying on regex length heuristics.
2.  **Implement `VirtualScreen`**:
    *   Create a 2D grid (buffer) representing the terminal window (e.g., 80x30).
    *   `VteParser` outputs "Screen Events" (`PutChar`, `MoveCursor`, `ClearLine`).
    *   `VirtualScreen` consumes these events to maintain the current visual state.
3.  **Unit Test the Parser**:
    *   Create a new test suite using raw byte arrays as input and expected screen states as output.

### Phase 2: The PTY Isolation Layer (Worker Threads)
*Goal: Eliminate `EPIPE` and orphaned processes by isolating `node-pty`.*

1.  **Create `pty-worker.ts`**:
    *   Entry point for `worker_threads` instance.
    *   Encapsulates `PtyDriver` and `PtyTask` queue.
    *   Communicates via `parentPort.postMessage`.
2.  **Refactor `PtySession` into a Proxy**:
    *   Manage the lifecycle of the `Worker` instead of the driver.
    *   `write()`, `close()`, and `spawn()` send IPC messages and return promises.
3.  **Isolate Native Lifecycle**:
    *   Worker thread handles all `node-pty` events, making it immune to main-process CPU starvation/GC spikes.

### Phase 3: The Driver Pivot (Native Docker TTY)
*Goal: Remove the "Local PTY $\rightarrow$ Docker" overhead.*

1.  **Rewrite `DockerDriver`**:
    *   Remove `node-pty` dependency for Docker.
    *   Use Docker Engine API `exec` with `{ Tty: true }`.
    *   Attach via raw TCP/WebSocket stream.
2.  **Unify the Stream**:
    *   Both `SimulationDriver` and `DockerDriver` emit raw bytes.
    *   Bytes are piped: `Driver` $\rightarrow$ `VteParser` $\rightarrow$ `VirtualScreen`.

### Phase 4: The Testing Strategy Migration
*Goal: Move from fragile string matching to robust state assertions.*

1.  **Update `IPtySession` and `contracts.ts`**:
    *   Add `getScreenState()` or `getVirtualBuffer()`.
2.  **Refactor Infrastructure Tests**:
    *   Replace `toBe("text")` with `toContain("text")` on the virtual screen state.
3.  **Implement Semantic Helpers**:
    *   `waitForText(session, "Expected String", timeout)` for polling screen state.

---

## 3. Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **IPC Overhead** | Low | `worker_threads` is efficient for PTY data volumes. |
| **Agent Interaction Breakage** | Medium | Ensure `VirtualScreen` can provide a "flattened" string for `IAgentAdapter` regex maps. |
| **Complexity Increase** | Medium | Strictly separate `Parser` (pure logic) from `Worker` (infrastructure). |
| **Docker API Changes** | Low | Docker TTY Attach API is a stable standard. |

---

## 4. Execution Roadmap

1.  **Step 1**: Implement `VteParser` and `VirtualScreen` $\rightarrow$ Verify with unit tests.
2.  **Step 2**: Implement `pty-worker.ts` and update `PtySession` as proxy $\rightarrow$ Verify `pty-session.test.ts`.
3.  **Step 3**: Rewrite `DockerDriver` to use native TTY streams $\rightarrow$ Verify `sandbox-pty-integration.test.ts`.
4.  **Step 4**: Migrate assertions in `tests/infrastructure/` to use `VirtualScreen`.
5.  **Step 5**: Stress test rapid spawn/close cycles to ensure no orphans/`EPIPE`.
