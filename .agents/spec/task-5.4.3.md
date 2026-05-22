# Task 5.4.3: Integrate FailureArtifactExporter into Evaluation Pipeline

## Context
- Module: `src/core/services/judge-service.ts`
- Requirement: Feature 5.4 (Failure Artifact Exporter)
- Goal: Wire `FailureArtifactExporter` into `JudgeService.runEvaluationPipeline()` so that failed runs automatically export their artifacts.

## Technical Directive
1. Update `JudgeService` constructor to optionally accept an `IFailureArtifactExporter`:
   - Add parameter `failureArtifactExporter?: IFailureArtifactExporter` after the existing parameters.
   - Store as private field.

2. In `runEvaluationPipeline()`, after persisting the `RunResult`, add logic:
   ```typescript
   if (result.regressionStatus === 'regressed' || result.regressionStatus === 'error') {
     if (this.failureArtifactExporter) {
       try {
         await this.failureArtifactExporter.exportForRun(runResult.runId);
       } catch (e) {
         console.error(`Failed to export artifacts for run ${runResult.runId}:`, e);
       }
     }
   }
   ```

3. Update `IJudgeService` interface in `contracts.ts` if its signature changes (prefer backward-compatible optional parameter).

4. Update `src/cli/evaluate.ts` to instantiate and pass the exporter.

## DoD
- Failed evaluations automatically trigger artifact export.
- Successful runs do NOT trigger artifact export.
- Failure of the exporter does not crash the evaluation pipeline.
- All existing tests pass without modification.
- `npm run typecheck` passes.
