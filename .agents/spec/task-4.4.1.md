# Task 4.4.1: Define ISemanticJudge interface and SemanticScore schema

**Goal:** Establish the contract for the LLM-based semantic judge service and the schema for its output scores.

**Tasks:**
1. Define `SemanticScore` entity (Correctness, Maintainability, Idiomaticity: 1-5).
2. Define `ISemanticJudge` interface in `src/core/contracts.ts`.
3. Add `SemanticScore` to `src/core/entities/evaluation-results.ts` (or create if needed).

**DoD:**
- Interface `ISemanticJudge` is defined and exported.
- `SemanticScore` schema is defined using Zod.
- Tests verify schema validation.
