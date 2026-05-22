# Task 5.4.4: CLI Integration (`repobench export-failures`)

## Context
- Module: `src/cli/index.ts`
- Requirement: Feature 5.4 (Failure Artifact Exporter)
- Goal: Add a standalone CLI command to retroactively export failure artifacts for existing failed runs.

## Technical Directive
1. Create `src/cli/export-failures.ts` with a `registerExportFailuresCommand(program)` function:
   - Command: `repobench export-failures`
   - Description: "Export failure artifacts (diff, logs, ground truth) for failed runs"
   - Options:
     - `-o, --output-dir <path>` — output directory (default: `exports`)
     - `--run-id <uuid>` — export artifacts for a single run (optional; if omitted, exports all failures)
   - Action:
     1. Call `initDatabase()`.
     2. Instantiate `CandidateRepository`, `RunResultRepository`, `FailureArtifactExporter`.
     3. If `--run-id` is provided, validate it exists and call `exporter.exportForRun(runId)`.
     4. Otherwise, call `exporter.exportAllFailures()`.
     5. Log the count of exported artifacts and their paths.

2. Call `registerExportFailuresCommand(program)` from `src/cli/index.ts`.

## DoD
- `repobench export-failures` CLI command is registered and functional.
- `repobench export-failures --run-id <uuid>` exports a single run.
- `repobench export-failures` (without flags) exports all failed runs.
- Artifacts land in the specified (or default `exports/`) directory.
- `npm run typecheck` passes.
