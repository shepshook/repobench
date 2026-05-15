# Task 1.2.2: Filter Validation Suite

## Context Map
- `src/core/services/filters/`: Future location of filter implementations.
- `tests/core/filters/`: Location for validation tests.

## Technical Directive
1. Create a "Golden Dataset" of Git diffs to be used for testing both **Significance** (noise removal) and **Purity** (intent validation).
2. The dataset must include representative examples of:
    - **Insignificant (Noise)**:
        - Pure Whitespace: Changes that are only tabs/spaces.
        - Comment Only: Changes that only modify `//` or `/* */` blocks.
        - Non-Code Files: Changes to `.md`, `.txt`, `.json` (non-config).
        - Lock Files: Changes to `package-lock.json` or `yarn.lock`.
    - **Significant but Impure**:
        - Massive Refactors: Changes affecting >10 files or >100 lines.
        - Mixed Intent: Changes that add a feature AND a fix.
    - **Significant and Pure**:
        - Minimal Logic Fixes: Small but meaningful code changes (e.g., changing `>` to `>=`).
3. Implement a test harness in `tests/core/filters/significance-validation.test.ts` that runs a filter against this dataset and calculates a precision/recall summary.

## DoD
- Validation suite contains at least 15 diverse diff examples covering noise, impurity, and purity.
- Test harness exists and can be executed via `npm test`.
- Dataset is stored in a way that it can be reused for tuning in Task 1.2.6.
