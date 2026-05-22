# Task 5.4.1: Define FailureArtifact Contracts & IFailureArtifactExporter Interface

## Context
- Module: `src/core/contracts.ts`
- Requirement: Feature 5.4 (Failure Artifact Exporter)
- Goal: Define the data contracts and exporter interface for exporting failure artifacts (diff, logs, ground truth) to the filesystem.

## Technical Directive
1. Add a `FailureArtifactSchema` zod schema in `src/core/contracts.ts`:
   - `runId: z.string().uuid()` — links back to the `RunResult`
   - `candidateId: z.string().uuid()`
   - `agentId: z.string()`
   - `regressionStatus: z.enum(['clean', 'regressed', 'error'])`
   - `diffPatchPath: z.string()` — path to the exported `diff.patch` file
   - `sessionLogPath: z.string()` — path to the exported `session.log` file
   - `groundTruthPath: z.string()` — path to the exported `ground-truth.diff` file
   - `exportedAt: z.date()`

2. Add `FailureArtifactExporterOptions` zod schema:
   - `outputDir: z.string().default('exports')` — root output directory
   - `runId: z.string().uuid()` — which run to export artifacts for

3. Define `IFailureArtifactExporter` interface:
   - `exportForRun(runId: string, options?: { outputDir?: string }): Promise<FailureArtifact>` — export artifacts for a single run
   - `exportAllFailures(options?: { outputDir?: string }): Promise<FailureArtifact[]>` — export artifacts for all failed runs

4. Do NOT modify existing `IDatasetExporter`, `IRunResultRepository`, or `EvaluationResult` interfaces.

## DoD
- `FailureArtifactSchema` exists with all required fields.
- `IFailureArtifactExporter` interface is declared with both methods.
- `npm run typecheck` passes.
