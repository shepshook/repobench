# Task 2.4.4: Verification & Performance Benchmarking

## Description
Develop a benchmark script to measure the reduction in sandbox initialization time and verify that dependencies are correctly cached and invalidated.

## Requirements
- Create a test script that measures:
  1. Cold start time (no cache).
  2. Warm start time (with cache).
  3. Cache Hit/Miss ratio.
- Verify dependency persistence between runs and correct invalidation upon dependency file changes.

## DoD
- Benchmark script created and successfully run.
- Cold/Warm start times and Hit/Miss ratios documented.
- Significant reduction in warm start init times observed.
- Feature 2.4 Definition of Done satisfied.

## Audit Feedback Round 1

The implementation of the benchmark script has failed the audit for the following reasons:

1. **Contract-First Violation**: The use of `@ts-ignore` for `sandbox.getCacheStats()` violates the architectural constraint defined in `ARCHITECTURE.md` Section 3.3. All domain models and service interfaces must be defined in `src/core/contracts.ts` before implementation.
2. **Incomplete Test Assertions**: The test `should have a faster warm start than cold start` measures time but does not contain any assertions to verify the requirement.
3. **Syntax Errors**: There is an `it` block on line 79 that is defined outside of the main `describe` block, which will cause test execution issues.
4. **DoD Unmet**: As the test script is incomplete and contains syntax errors, the requirements for creating and successfully running the benchmark script are not satisfied.

Please resolve these issues, ensuring the interface is properly updated in `contracts.ts` before implementing `getCacheStats`, and fix the test structure and assertions.

## Audit Feedback Round 2

The implementation still fails to satisfy the requirements of Task 2.4.4:

1. **Missing Benchmark Script**: No benchmark script exists. The Task requires a script that measures cold/warm start times and cache hit/miss ratios.
2. **Incomplete Implementation**: The `BenchmarkValidator` only performs validation, not benchmarking.
3. **Requirements Unmet**: The DoD (Benchmark script created, metrics documented, performance reduction verified) is entirely unfulfilled.

Please implement a proper benchmark script (e.g., as a CLI command or a dedicated test file that performs these measurements) and fulfill the DoD requirements.

