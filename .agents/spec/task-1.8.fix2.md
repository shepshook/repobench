# Task 1.8.FIX2: Fix CLI --since Date Validation Regex Round 1

## Context Map
- `src/cli/mine.ts`: Two functions validate the `--since` date parameter (`main()` at line 33 and `registerMineCommand()` at line 78).
- Both use the same strict regex: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/`
- This regex **rejects** simple ISO-8601 date format like `2025-01-01`.

## Root Cause
The DoD for Feature 1.8 states: `repobench mine --since 2025-01-01` returns only commits after that date. The current CLI validation only accepts full ISO-8601 datetime strings (e.g., `2025-01-01T00:00:00Z`). The simple date format `YYYY-MM-DD` is a valid ISO-8601 date and is accepted by `git log --since=2025-01-01`, but the CLI regex rejects it before it reaches the miner.

## Technical Directive
1. In **both** validation locations in `src/cli/mine.ts` (the `main()` function and the `registerMineCommand()` action), update the regex to also accept `YYYY-MM-DD` (date-only) format:
   ```typescript
   /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/
   ```
   This accepts:
   - `2025-01-01` (date only)
   - `2025-01-01T00:00:00Z` (full datetime)
   - `2025-01-01T00:00:00.123Z` (with fractional seconds)
   - `2025-01-01T00:00:00+05:30` (with timezone offset)
2. Update the error message to mention both formats:
   ```
   'Error: Invalid --since date format. Expected ISO-8601 (e.g., 2024-01-01 or 2024-01-01T00:00:00Z).'
   ```
3. The `--since` value flows through to `git log --since=...` which accepts all ISO-8601 formats natively — no additional parsing needed.

## Testing
- `--since 2025-01-01` passes validation.
- `--since 2025-01-01T00:00:00Z` passes validation.
- `--since not-a-date` shows a helpful error message.
- All existing miner and CLI tests pass.

## Verification
- `npm run typecheck && npm run lint` passes.
- `npx vitest run tests/integration/mine.test.ts` passes (the `--since` integration test).
- Manual: `repobench mine --since 2025-01-01` does not produce a date format error.

## Audit Feedback Round 1
- **Status**: FAIL
- **Review**: The regex validation correctly allows `YYYY-MM-DD` format as per requirements. However, the integration tests `tests/integration/mine.test.ts` failed for both full ISO-8601 and date-only formats. 
- **Observations**: 
    - The `npm run typecheck` and `npm run lint` passed.
    - `should filter commits by --since date when passed via CLI` failed (expected 1 candidate, found 0).
    - `should filter commits by --since date when using date-only format YYYY-MM-DD` failed (expected 1 candidate, found 0).
- **Recommendation**: Investigate why `git log` (or the underlying filtering logic) is not returning the expected candidates when `--since` is provided. The `config.mining.since` appears to be set (as validation passes), so the issue likely lies in how this value is consumed by the mining service.
