# Spec: Task 4.2.4: Integrate SearchEfficiencyTracker into EvaluatorPipeline
Goal: Integrate the `SearchEfficiencyTracker` into the `Judge` module.
Implementation Details:
- Initialize/close the tracker per agent session in `EvaluatorPipeline`.
- Ensure metrics are integrated into run results reporting.

## Audit Feedback Round 1
- The integration of `SearchEfficiencyTracker` into `EvaluatorPipeline` (within `Evaluator.ts`) broke existing unit tests in `tests/core/services/evaluator.test.ts`. 
- The `mockSandbox` in the test setup lacks the `getFileAccessTracker()` method, which is now invoked in `Evaluator.evaluate`.
- The tests need to be updated to mock this method and provide a test-appropriate implementation of `IFileAccessTracker`.
