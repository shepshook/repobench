# Task 1.5.2: BenchmarkValidator Implementation

## Context Map
- `src/core/contracts.ts`: `IBenchmarkValidator`, `ValidationResult`, `Candidate`.
- `src/core/contracts.ts`: `ISandbox`.
- `src/core/config.ts`: `SandboxConfig` (to get `testCommand`).

## Technical Directive
1. Create `BenchmarkValidator` class in `src/core/services/benchmark-validator.ts` implementing `IBenchmarkValidator`.
2. The validator must:
    - Require an `ISandbox` instance via constructor (DI).
    - Require `RepoBenchConfig` to retrieve the `testCommand`.
3. Implementation Logic for `validate(candidate)`:
    - **Pre-fix check**:
        - `await sandbox.switchState(candidate.hash + '^')` (the parent of the commit).
        - `await sandbox.execute(config.mining.testCommand)`.
        - Capture exit code and output. Status is 'pass' if exitCode === 0, otherwise 'fail'.
    - **Post-fix check**:
        - `await sandbox.switchState(candidate.hash)`.
        - `await sandbox.execute(config.mining.testCommand)`.
        - Capture exit code and output. Status is 'pass' if exitCode === 0, otherwise 'fail'.
    - **Result**: `isValid = (preFixStatus === 'fail' && postFixStatus === 'pass')`.
4. **TDD Mandate**: Implement using TDD. Write tests first that mock `ISandbox` to verify:
    - Correct handling of `switchState` success/failure.
    - Correct binary success determination (Pre-Fail && Post-Pass).
    - Proper handling of sandbox execution timeouts, crashes, or internal errors (mark as 'error').
5. Include error handling to catch sandbox crashes and mark them as 'error'.

## DoD
- [ ] `BenchmarkValidator` successfully implements `IBenchmarkValidator`.
- [ ] Unit tests verify:
    - Valid fix (Fail $\rightarrow$ Pass) $\Rightarrow$ `isValid: true`.
    - Already passing (Pass $\rightarrow$ Pass) $\Rightarrow$ `isValid: false`.
    - Still failing (Fail $\rightarrow$ Fail) $\Rightarrow$ `isValid: false`.
    - Regression (Pass $\rightarrow$ Fail) $\Rightarrow$ `isValid: false`.
- [ ] `npm run test` passes.
