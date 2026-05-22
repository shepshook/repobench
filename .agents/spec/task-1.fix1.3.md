# Task 1.FIX1.3: Log Skipped Candidates in JSONL Exporter

**Parent:** Feature 1.FIX1: Global Epic Integration & Alignment Round 1
**Priority:** Low
**Estimated Effort:** 10 min

## Objective
The `JsonlDatasetExporter` in `src/infrastructure/jsonl-dataset-exporter.ts:37-38` silently ignores candidates that fail `CandidateExportSchema` validation (typically because `preFixHash` or `postFixHash` is missing/undefined). Add a `console.warn` to log which candidates are skipped and why, so operators can diagnose data gaps.

## Change

### `src/infrastructure/jsonl-dataset-exporter.ts:37-38`
Current:
```typescript
} else {
  // Silently ignore candidates that do not meet the export schema requirements
}
```
Replace with:
```typescript
} else {
  console.warn(`Skipping candidate ${c.id} during export: ${validation.error.message}`);
}
```

## Verification
- `npm run typecheck` passes
- `npm run lint` passes
- The string `Silently ignore` no longer appears in `src/infrastructure/jsonl-dataset-exporter.ts`
