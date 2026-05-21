# Task 4.1.1: Design and Implement IRegressionTestRunner Interface

## Goal
Define the contract for the regression test runner component within the `Judge` module to support pre-fix and post-fix test execution comparison.

## Requirements
- Define `IRegressionTestRunner` interface in `src/core/contracts.ts` (Mandatory: Contract-First Development).
- Interface must support:
    - Running tests (`runTests(sandbox: ISandbox, command: string): Promise<TestResults>`)
    - Comparing results (`compareResults(pre: TestResults, post: TestResults): ComparisonResult`)
- Ensure compliance with `ARCHITECTURE.md` naming conventions (PascalCase, prefixed with I).

## DoD
- Interface is defined and exported.
- Reviewed for alignment with existing `ISandbox` and `IEvaluator` interfaces.
