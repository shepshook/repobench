# Task 1.5.1: Validation Contract & Schema

## Context Map
- `src/core/contracts.ts`: Location for all interfaces and Zod schemas.
- `ISandbox`: Required dependency for validation.

## Technical Directive
1. Define `ValidationResultSchema` using Zod:
    - `isValid`: boolean (Pre-Fail AND Post-Pass)
    - `preFixStatus`: 'fail' | 'pass' | 'error'
    - `postFixStatus`: 'fail' | 'pass' | 'error'
    - `preFixOutput`: string (stdout/stderr of the pre-fix test run)
    - `postFixOutput`: string (stdout/stderr of the post-fix test run)
    - `latency`: number (total time taken for validation)
2. Define `IBenchmarkValidator` interface:
    - `validate(candidate: Candidate): Promise<ValidationResult>`
3. Export both from `src/core/contracts.ts`.

## DoD
- [ ] `IBenchmarkValidator` and `ValidationResultSchema` are defined in `src/core/contracts.ts`.
- [ ] Project compiles without errors (`npm run typecheck`).
