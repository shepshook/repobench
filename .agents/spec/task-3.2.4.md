# Task 3.2.4: Integrate Adapter Selection in SessionOrchestrator

## Goal
Update the `SessionOrchestrator` to use the appropriate `IAgentAdapter` based on configuration.

## Implementation Details
- Implement `AgentAdapterFactory` to resolve the appropriate `IAgentAdapter` based on configuration, adhering to the Factory Pattern to ensure Open/Closed compliance.
- Update `src/core/services/session-orchestrator.ts` to use `AgentAdapterFactory`.
- Pass the adapter instance to `PtySession.create()`.

## DoD
- `SessionOrchestrator` correctly selects and uses the adapter via factory.
- New agents can be added by simply creating a new adapter class without modifying the orchestrator logic.
- Unit tests verify the adapter factory correctly selects adapters.

## Audit Feedback Round 1
The implementation for Task 3.2.4 is missing. The required file `src/core/services/session-orchestrator.ts` does not exist in the codebase. Please implement the `SessionOrchestrator` and `AgentAdapterFactory` as specified in the Implementation Details.

## Audit Feedback Round 3
The implementation for `AgentAdapterFactory` exists in `src/core/services/agent-adapter-factory.ts` and `SessionOrchestrator` uses it. However, the Definition of Done (DoD) requires unit tests for the `AgentAdapterFactory` to verify correct adapter selection, which are currently missing. Please implement `tests/core/services/agent-adapter-factory.test.ts`.
