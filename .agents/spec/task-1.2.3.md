# Task 1.2.3: BasicSignificanceFilter Implementation

## Context Map
- `src/core/contracts.ts`: `ISignificanceFilter` interface.
- `src/core/services/filters/significance-filter.ts`: Implementation file.
- `tests/core/filters/significance-validation.test.ts`: The validation suite from Task 1.2.2.

## Technical Directive
1. Implement `BasicSignificanceFilter` implementing `ISignificanceFilter`.
2. Logic must focus on **Significance** (Noise Removal):
    - Use `git diff -w` to detect whitespace-only changes.
    - Use regex to detect comment-only changes.
    - Filter out common non-code extensions.
3. Verify the implementation against the "Insignificant (Noise)" portion of the Golden Dataset.
4. Iteratively refine the logic until all identified noise is correctly filtered out.

## DoD
- `BasicSignificanceFilter` implements `ISignificanceFilter`.
- All "Insignificant (Noise)" examples in the Golden Dataset are correctly marked as `isSignificant = false`.
- `npm run typecheck` passes.
