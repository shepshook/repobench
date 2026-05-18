# Task 2.1.1: Update `repobench.yaml` Schema for Sandbox Config

## Description
Extend the `repobench.yaml` configuration schema to support sandbox-specific settings.

## Tasks
- [ ] Define Zod schema for `sandbox` configuration (including `build_command`, `test_command`, `env_vars`). Ensure internal representation uses `camelCase` where appropriate.
- [ ] Update `repobench.yaml` parser to load these new configuration fields.
- [ ] Ensure backward compatibility for projects without these settings.

## DoD
- The configuration parser correctly reads and validates the new `sandbox` fields from `repobench.yaml`.
- Missing fields result in reasonable defaults or safe failures.
- Invalid configuration throws a clear, descriptive validation error.
