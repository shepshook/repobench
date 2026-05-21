# Spec: Task 4.2.2: Define ISearchEfficiencyTracker & EfficiencyMetrics Schema
Goal: Define `ISearchEfficiencyTracker` and `EfficiencyMetrics` (using `zod` for validation).
Implementation Details:
- Define `ISearchEfficiencyTracker` in `src/core/contracts.ts`.
- Define `EfficiencyMetrics` schema with `zod` in `src/core/entities/search-efficiency.ts`.
- Clearly define the scope of "Files Accessed" and "Files Modified" as per the design in Task 4.2.1.

## Audit Feedback Round 1
The implementation is missing the required definitions for "Files Accessed" and "Files Modified". These definitions must be included as JSDoc comments within `src/core/contracts.ts` or `src/core/entities/search-efficiency.ts` to clearly specify their scope as designed in Task 4.2.1.
