# Task 5.FIX2.2: Epic Audit — Remediate Silent Error Swallowing in FailureArtifactExporter Round 2

**Epic:** 5 — Comparative Analysis & Reporting
**Feature:** 5.FIX2 — Global Epic Integration & Alignment Round 2
**Assigned to:** Agent
**Status:** Not Started

---

## Objective
Add error logging to the three empty `catch { }` blocks in `FailureArtifactExporter` so the original root cause is preserved when fallback content is written. This satisfies ARCHITECTURE.md §4.3 "No Silent Failures."

## Context
- `src/infrastructure/failure-artifact-exporter.ts` has three `catch` blocks with no error variable binding and no logging:
  - **Line 41** (`exportForRun`, diff.patch generation via sandbox) — catches sandbox failures silently, writes a generic fallback message.
  - **Line 59** (`exportForRun`, session.log copy) — catches filesystem failures silently, writes a JSON metadata fallback.
  - **Line 85** (`exportForRun`, ground-truth.diff generation via sandbox) — catches sandbox failures silently, writes a generic fallback message.
- ARCHITECTURE.md §4.3 states: *"No Silent Failures: Do not swallow errors. ... Throw descriptive errors that include the stdout or stderr context to assist RCA."*
- The fallback behavior (writing placeholder content) is architecturally correct — the issue is only that the original error context is permanently lost, making Root Cause Analysis impossible.

## Instructions

### Step 1 — Bind error variable and log in all three catch blocks
In `src/infrastructure/failure-artifact-exporter.ts`, modify each empty `catch` block:

**Line 41 — diff.patch catch:**
```ts
// Before:
} catch {
  if (candidate.postFixHash) { ... }

// After:
} catch (err) {
  console.warn(`[FailureArtifactExporter] Failed to generate diff.patch for run ${runId}:`,
    err instanceof Error ? err.message : String(err));
  if (candidate.postFixHash) { ... }
```

**Line 59 — session.log catch:**
```ts
// Before:
} catch {
  await fs.writeFile(sessionLogPath, JSON.stringify({...}), 'utf8');

// After:
} catch (err) {
  console.warn(`[FailureArtifactExporter] Failed to copy session log for run ${runId}:`,
    err instanceof Error ? err.message : String(err));
  await fs.writeFile(sessionLogPath, JSON.stringify({...}), 'utf8');
```

**Line 85 — ground-truth.diff catch:**
```ts
// Before:
} catch {
  await fs.writeFile(groundTruthPath, `...`, 'utf8');

// After:
} catch (err) {
  console.warn(`[FailureArtifactExporter] Failed to generate ground-truth.diff for run ${runId}:`,
    err instanceof Error ? err.message : String(err));
  await fs.writeFile(groundTruthPath, `...`, 'utf8');
```

### Step 2 — Verify
- Run `npm run typecheck` — must pass with zero errors.
- Run `npm run lint` — must pass with zero errors.
- Run `npx vitest run tests/infrastructure/failure-artifact-exporter.test.ts` — all tests must pass.
- Run `npx vitest run tests/integration/export-failures-cli.test.ts` — all tests must pass.
- The existing test "produces partial artifacts without sandbox" should continue to pass unchanged (it tests that fallback content is written — now with console.warn stderr output which is expected).

## Acceptance Criteria
1. All three `catch` blocks in `failure-artifact-exporter.ts` bind an error variable (`catch (err)`) and log via `console.warn` before writing fallback content.
2. The `[FailureArtifactExporter]` prefix is present in all log messages for grep-ability.
3. TypeScript typechecks cleanly.
4. All existing tests pass without modification.
5. ESLint passes cleanly.
