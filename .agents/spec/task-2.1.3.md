# Task 2.1.3: Integration Tests for Sandbox Configuration

## Description
Create integration tests to verify that the sandbox correctly uses the custom configuration.

## Tasks
- [ ] Create test case with a custom `build_command` that creates a file.
- [ ] Create test case with a custom `test_command` that succeeds/fails as expected.
- [ ] Verify that `env_vars` are correctly passed to the container.
- [ ] Create test case to verify behavior when `build_command` fails (e.g., sandbox reports failure correctly).
- [ ] Create test case to verify behavior when `repobench.yaml` contains invalid configuration.

## DoD
- Integration tests confirm that `build_command` runs during initialization.
- Integration tests confirm that `test_command` can be invoked through the sandbox.
- Environment variables are accessible during execution.
- Sandbox reports errors when `build_command` fails.
- Parser reports clear validation errors for invalid `repobench.yaml`.
