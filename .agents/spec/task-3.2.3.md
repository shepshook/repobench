# Task 3.2.3: Implement ClaudeCodeAdapter

## Goal
Implement the concrete adapter for ClaudeCode.

## Implementation Details
- Create `src/infrastructure/agents/claude-code-adapter.ts` extending `AgentAdapter`.
- Define the `interactionMap` for ClaudeCode conversational prompts.
- Implement `getStartupCommand()`.

## DoD
- `ClaudeCodeAdapter` implements `IAgentAdapter`.
- Regex interaction map covers essential ClaudeCode conversational prompts.
- Passes all type checks.
- Unit tests verify ClaudeCodeAdapter interaction mapping logic.
