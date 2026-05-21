# Spec: Task 4.2.1: Design File Access Interception Mechanism
Goal: Design and document the interception mechanism for tracking file access in the sandbox, considering performance bottlenecks and accuracy.
Implementation Details:
- Evaluate trade-offs between I/O monitoring via `inotify`, `LD_PRELOAD` library injection, or container-level file system auditing.
- Select the approach that minimizes performance overhead.
- Document the chosen strategy in a design spec, including how "Files Modified" will be defined and tracked.

## Audit Feedback Round 1
Task 4.2.1 implementation is missing. Please implement the designed file access interception mechanism in accordance with the project's architectural guidelines, ensuring it integrates with the existing Sandbox infrastructure and avoids performance bottlenecks.

## Audit Feedback Round 2
Implementation for Task 4.2.1 is still missing. No design document or implementation code exists in the repository. Please complete the design and implementation as per the spec.

## ESCALATION DIRECTIVE

**Decision: (A) Continue** — implementation exists but was masked by stale `@ts-expect-error` directives in tests. The following were the root causes of the stalled audit loop:

### Root Cause 1: Stale @ts-expect-error Masking
The test file (`tests/infrastructure/sandbox-file-interception.test.ts`) used `@ts-expect-error` on **every** interaction with `getFileAccessTracker`. This made the tests appear speculative (pre-implementation scaffolding) and signaled to automated audit tools and reviewers that the feature "doesn't compile yet." In reality, the full implementation was present:
- `IFileAccessTracker` interface in `src/core/contracts.ts:127-131`
- `ISandbox.getFileAccessTracker()` in `src/core/contracts.ts:146`
- `FileAccessTracker` class in `src/infrastructure/sandbox.ts:13-41`
- `Sandbox.getFileAccessTracker()` in `src/infrastructure/sandbox.ts:85-87`
- Command-pattern interception in `Sandbox.execute()` at `sandbox.ts:362-377`

**Fix applied:** All `@ts-expect-error` directives removed from the test file. Tests pass 4/4.

### Root Cause 2: Spec/Audit Misalignment
The spec says: *"Design and document the interception mechanism"* — this is a **design** task.  
The audit feedback says: *"Please implement the designed file access interception mechanism"* — this asks for **implementation**.

The implementation happened organically during Sandbox development (the tracker is private to `sandbox.ts` and was added as a lightweight utility). No formal design document evaluating the trade-offs between `inotify` vs `LD_PRELOAD` vs container-level fs auditing was ever produced. To close this gap, the following design summary is provided inline.

### Current Approach: Command-String Interception
- **Method:** Parse command strings entering `Sandbox.execute()` for known file-operation patterns (`touch`, `rm`, `cat`, `ls`, `grep`, `>`, `>>`).
- **Where:** `src/infrastructure/sandbox.ts` lines 362-377.
- **Limitations:**
  1. Only intercepts commands routed through `Sandbox.execute()` — commands executed directly inside a Docker container (e.g., via an interactive PTY agent session) are **not** tracked.
  2. Pattern matching is fragile — wildcards, pipes, and compound commands may produce false negatives.
  3. No kernel-level interception (`inotify`, `fanotify`, `LD_PRELOAD`) is implemented.
- **Strengths:**
  1. Zero overhead — no additional infrastructure, daemons, or libraries.
  2. Works identically in both Docker and simulation modes.
  3. Sufficient for the efficiency metric: $\text{Files Accessed} / \text{Files Modified}$.

### Recommended Path Forward (for Task 4.2.2 onward)
1. **Task 4.2.2:** Define `ISearchEfficiencyTracker` interface and `EfficiencyMetrics` schema in `contracts.ts`. The interface should consume `IFileAccessTracker` data and compute the access/modification ratio.
2. **Task 4.2.3:** Implement `SearchEfficiencyTracker` service that wraps `IFileAccessTracker` and adds timestamp bucketing for per-command granularity.
3. **Task 4.2.4:** Integrate into `EvaluatorPipeline` — call `sandbox.getFileAccessTracker()` after the agent session completes.
4. **Future enhancement** (post-MVP): Consider Docker `auditd` rules or a sidecar process using `inotifywait` inside the container for full filesystem coverage during interactive sessions.
