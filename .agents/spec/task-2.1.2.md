# Task 2.1.2: Update `Sandbox` Interface and Implementation
## Description
Update the `Sandbox` module to utilize the new configuration fields loaded from `repobench.yaml`.

## Tasks
- [ ] Update `src/core/contracts.ts` to include the new sandbox configuration in the `ISandbox` interface *before* implementation changes.
- [ ] Update `Sandbox.init` to use `build_command` for container preparation.
- [ ] Store `test_command` and `env_vars` for later execution.
- [ ] Ensure all I/O operations (e.g., executing `build_command`) are wrapped in `try/catch` blocks.
- [ ] Throw descriptive errors that include `stdout` or `stderr` context for any failures.

## DoD
- `src/core/contracts.ts` is updated first.
- `Sandbox.init` properly executes the provided `build_command` within the container.
- `env_vars` are correctly applied to the sandbox environment.
- The `Sandbox` instance maintains the state of the provided test command.
- Failures in I/O operations are caught and provide clear error context.

## Audit Feedback Round 1
The implementation in `src/infrastructure/sandbox.ts` is insufficient. 
1. The `init` method does not actually execute the `buildCommand`, but rather contains hardcoded logic to simulate a failure for testing purposes.
2. The requirement to properly execute the `build_command` within a container is not met; it needs a real implementation, not just mock behavior.
3. The error handling does not properly capture the output of an actual command execution, it just fills dummy error properties.

## Audit Feedback Round 2
The implementation has improved, but still fails on environment variable handling:
1. Environment variables set in `SandboxConfig` (and applied during `init`) are lost when executing commands via `Sandbox.execute()` because `docker.exec` overrides the environment if `Env` is provided. The implementation must merge the container's default environment variables with any provided in `options`.
2. The requirement "Store `test_command` and `env_vars` for later execution" is not fully met as `execute()` does not automatically include the stored `envVars` when no custom environment is provided.
