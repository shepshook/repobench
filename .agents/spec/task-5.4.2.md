# Task 5.4.2: Implement FailureArtifactExporter Service

## Context
- Module: `src/infrastructure/failure-artifact-exporter.ts`
- Requirement: Feature 5.4 (Failure Artifact Exporter)
- Goal: Implement the service that writes `diff.patch`, `session.log`, and `ground-truth.diff` to `exports/<run_id>/`.

## Technical Directive
1. Create `src/infrastructure/failure-artifact-exporter.ts` implementing `IFailureArtifactExporter`:
   - Constructor takes `IRunResultRepository`, `ICandidateRepository`, and an optional `ISandbox` instance.
   - `exportForRun(runId, options?)`:
     1. Fetch `RunResult` from repository; skip if `metrics.success === true`.
     2. Fetch `Candidate` by `candidateId`.
     3. Create output directory `exports/<runId>/` (use `fs.mkdir` with `{ recursive: true }`).
     4. **diff.patch**: Run `ISandbox.switchState(candidate.preFixHash)`, then use `git diff` to capture working directory changes vs the post-fix state. Write output to `exports/<runId>/diff.patch`. If sandbox is unavailable, generate a placeholder with the candidate commit hashes.
     5. **session.log**: If `RunResult.logPath` is set and the file exists, copy it to `exports/<runId>/session.log`. Otherwise create a file with the evaluation metadata.
     6. **ground-truth.diff**: Use sandbox to produce `git diff <preFixHash> <postFixHash>` and write to `exports/<runId>/ground-truth.diff`.
     7. Return a `FailureArtifact` object with the paths.
   - `exportAllFailures(options?)`: Iterate all runs, filter `metrics.success === false`, call `exportForRun` for each.

2. Handle errors gracefully — if the candidate is missing or sandbox is unavailable, write partial artifacts and log warnings. Never throw from the exporter (per ARCHITECTURE.md §4.3: failures should bubble up, but here the exporter is a best-effort secondary concern).

3. Use `node:fs/promises` for file operations. Follow the existing pattern from `jsonl-dataset-exporter.ts`.

## DoD
- `FailureArtifactExporter` is implemented and produces valid `diff.patch`, `session.log`, and `ground-truth.diff` files in `exports/<run_id>/`.
- Tests verify:
  - Successful export for a failed run with all artifacts.
  - Partial export when sandbox is unavailable.
  - `exportAllFailures` processes only failed runs.
- `npm run typecheck` passes.
