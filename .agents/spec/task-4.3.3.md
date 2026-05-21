# Task 4.3.3: Integration into EvaluatorPipeline

## Description
Integrate `EScoreService` into the `EvaluatorPipeline` to calculate the E-Score upon completion of a run.

## Specification
- Update `EvaluatorPipeline` to use `EScoreService` after test/regression execution.
- Ensure the E-Score is stored in the result object.

## DoD
- `EvaluatorPipeline` correctly computes and attaches an E-Score to the evaluation results.
