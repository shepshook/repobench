# Task 4.1.2: Implement RegressionTestRunner Service

## Goal
Implement the `RegressionTestRunner` service based on the `IRegressionTestRunner` interface defined in 4.1.1.

## Requirements
- Implement `RegressionTestRunner` class.
- Leverage `ISandbox.execute` (using `container.exec()` per `ARCHITECTURE.md` §6) to run the `test_command` in batch mode (avoid PTY).
- Implement `compareResults` logic to detect regressions (tests passing in pre-fix but failing in post-fix).
- Adhere to error handling standards (`try/catch` with descriptive errors).

## DoD
- Service is implemented.
- Logic correctly executes test commands and parses/compares results.
