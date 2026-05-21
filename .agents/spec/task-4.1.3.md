# Task 4.1.3: Integrate RegressionTestRunner into Evaluator Pipeline

## Goal
Connect the `RegressionTestRunner` into the `Judge` evaluation pipeline.

## Requirements
- Update `Evaluator` (or equivalent service) to use `RegressionTestRunner`.
- Ensure that if `compareResults` detects regressions, the candidate is marked as 'FAILED'.
- Update logs/reporting to clearly state if a regression occurred.

## DoD
- Evaluation pipeline calls the runner.
- Candidates with regressions are correctly invalidated.
