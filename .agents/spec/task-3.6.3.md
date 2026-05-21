# Task 3.6.3: Integrate Configuration into BatchRunner

## Description
Update the `BatchRunner` to utilize the `AgentConfigLoader` and pass relevant configurations to the agent adapters during session orchestration.

## Specs
- Modify `BatchRunner` to load configurations.
- Update `SessionOrchestrator` to accept `AgentConfig`.
- Map configurations to the adapter-specific parameters.

## DoD
- Agents are launched with parameters specified in `agents.yaml`.
