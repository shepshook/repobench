# Task 5.1.1: Define RunResult Entity & Repository Interface

## Context
- Module: `src/core/contracts.ts`
- Requirement: Feature 5.1 (Results Persistence Layer)
- Goal: Define the domain model and repository interface for persisting evaluation run results.

## Technical Directive
1. Review and update `RunResultSchema` in `src/core/contracts.ts` to align with the DoD (tracking agent, candidate, cost, E-Score). Ensure it includes:
   - `runId: z.string().uuid()`, `agentId: z.string()`, `candidateId: z.string().uuid()`
   - `metrics: z.object({ success: z.boolean(), cost: z.number(), latency: z.number(), eScore: z.number() })`
   - `timestamp: z.date()`, `logPath: z.string().optional()`
2. Define `IRunResultRepository` interface in `src/core/contracts.ts`:
   - `save(run: RunResult): void`
   - `getById(runId: string): RunResult | undefined`
   - `getAll(): RunResult[]`
   - `getByAgentId(agentId: string): RunResult[]`
   - `getByCandidateId(candidateId: string): RunResult[]`

## DoD
- `RunResultSchema` and `RunResult` type are finalized in `src/core/contracts.ts` with `logPath` as optional.
- `IRunResultRepository` interface is defined in `src/core/contracts.ts`.
