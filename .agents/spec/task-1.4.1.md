# Task 1.4.1: Curation Service Contract Definition

## Context
- **Module**: Miner
- **Affected Files**: `src/core/contracts.ts`, `src/core/entities/candidate.ts`

## Technical Directive
- Define `ICurationService` in `src/core/contracts.ts`.
- Define `CurationResult` interface (includes `score`, `reasoning`, `isApproved`).
- Use `zod` for `CurationResult` validation.

## DoD
- Interface exists in `contracts.ts`.
- `CurationResult` schema defined and validated.
- No implementation logic in this task.
