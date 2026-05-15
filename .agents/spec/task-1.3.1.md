# Task 1.3.1: Define Candidate Entity & Repository Interface

## Context
- Module: `core/contracts.ts`
- Requirement: Feature 1.3 (Candidate Persistence Layer)
- Goal: Define domain models and interfaces.

## Technical Directive
1. Define `Candidate` entity in `src/core/contracts.ts`.
2. Define `ICandidateRepository` interface in `src/core/contracts.ts`.
   - `save(candidate: Candidate): void`
   - `exists(hash: string): boolean`
   - `getAll(): Candidate[]`

## DoD
- Interface and entity exist in `src/core/contracts.ts`.
