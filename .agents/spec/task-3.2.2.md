# Task 3.2.2: Implement AiderAdapter

## Goal
Implement the concrete adapter for Aider.

## Implementation Details
- Create `src/infrastructure/agents/aider-adapter.ts` extending `AgentAdapter`.
- Define the `interactionMap` for Aider (handling common prompts like "Would you like to...").
- Implement `getStartupCommand()` to launch Aider with appropriate flags (e.g., `--no-git` or similar to prevent interference).

## DoD
- `AiderAdapter` implements `IAgentAdapter`.
- Regex interaction map covers essential Aider conversational prompts.
- Passes all type checks.
- Unit tests verify AiderAdapter interaction mapping logic.
