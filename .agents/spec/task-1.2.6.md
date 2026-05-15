# Task 1.2.6: Purity Threshold Tuning

## Context Map
- `src/core/services/filters/significance-filter.ts`: Filter implementation.
- `tests/core/filters/significance-validation.test.ts`: Validation suite.

## Technical Directive
1. Implement **Purity** thresholds to identify "Pure Fixes":
    - **Max Files**: Discard commits modifying more than N files (e.g., N=5).
    - **Max Lines**: Discard commits where total lines changed exceed M (e.g., M=50).
    - **Min Change**: Ensure at least one line of actual code (non-whitespace, non-comment) was changed.
2. Use the "Significant but Impure" and "Significant and Pure" examples in the Golden Dataset to tune these thresholds.
3. Document the chosen thresholds within the implementation or via a configuration schema.

## DoD
- Purity thresholds (file count, line count) are implemented and verified.
- "Significant but Impure" examples (massive refactors) are correctly marked as `isSignificant = false`.
- "Significant and Pure" examples (small logic fixes) are correctly marked as `isSignificant = true`.
- `npm run typecheck` passes.
