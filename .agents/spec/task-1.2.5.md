# Task 1.2.5: File-Level Noise Filtering

## Context Map
- `src/core/services/filters/significance-filter.ts`: Filter implementation.
- `tests/core/filters/significance-validation.test.ts`: Validation suite.

## Technical Directive
1. Extend `BasicSignificanceFilter` to handle **File-Level** noise:
    - **Lock Files**: Explicitly ignore `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
    - **Docs/Assets**: Refine the non-code extension list to be more comprehensive (e.g., `.md`, `.txt`, `.svg`, `.png`).
2. Verify the implementation against the "Lock Files" and "Non-Code Files" examples in the Golden Dataset.

## DoD
- Lock files and common non-code files are correctly filtered.
- All corresponding examples in the Golden Dataset are marked as `isSignificant = false`.
- `npm run typecheck` passes.
