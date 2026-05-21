# Task: Integrate EScoreService into EvaluatorPipeline
# RoadMap: 4.3.3

## Plan

- [ ] Sub-task 1: Update `EvaluationResult` interface to include `eScore`.
- [ ] Sub-task 2: Update `IEvaluator.evaluate` interface to accept `cost`? (Need to rethink this).
- [ ] Sub-task 3: Update `Evaluator` to accept `IScorer` and compute `eScore`.
- [ ] Sub-task 4: Update `JudgeService.runEvaluationPipeline` to handle the cost fetching and eScore computation.
- [ ] Sub-task 5: Add tests for `Evaluator` and `JudgeService` to verify `eScore` is computed.
