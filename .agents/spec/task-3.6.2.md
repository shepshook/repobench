# Task 3.6.2: Implement Agent Configuration Loader

## Description
Implement the service responsible for loading and validating the `agents.yaml` configuration file.

## Specs
- Create `AgentConfigLoader` service in `src/core/services/agent-config-loader.ts`.
- The loader should read `agents.yaml` from the project root.
- Validate the YAML content against the Zod schema defined in Task 3.6.1.

## DoD
- `agents.yaml` is correctly parsed into `AgentConfig` objects.
