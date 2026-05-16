# Task 1.6.FIX2: Feature Review Alignment Round 2

## Findings from Feature Closure Audit

The closure audit for Feature 1.6 revealed several regressions and architectural misalignments that must be addressed before the feature can be marked as complete.

### 1. Importer Deduplication Failure
The `JsonlDatasetImporter` is failing to correctly handle duplicate entries. Tests in `tests/integration/import-jsonl.test.ts` show that importing the same file multiple times results in duplicate records in the database instead of updating existing ones (upsert).
- **Observation:** `expect(repo.getAll()).toHaveLength(1)` failed with `got 4`.
- **Requirement:** The importer must use the candidate ID to perform an upsert operation.

### 2. Export Filtering Violation
The `DatasetExporter` (and its CLI integration) is exporting candidates that are not curated or approved.
- **Observation:** `tests/integration/task-1.6.fix1.test.ts` failed because it found 2 exported candidates when only 1 (curated/approved) was expected.
- **Requirement:** Only candidates that have passed curation and are marked as approved should be included in the export.

### 3. CLI Export Counting Issues
The CLI command for exporting datasets is reporting 0 candidates processed even when candidates exist and should be exported.
- **Observation:** `tests/integration/cli-portability.test.ts` received `Export successful: 0 candidate(s) processed` instead of `1 candidate(s) processed`.

## Required Fixes

- [ ] Fix `JsonlDatasetImporter` to implement proper upsert logic based on candidate ID.
- [ ] Update `DatasetExporter` filter logic to strictly include only curated and approved candidates.
- [ ] Debug CLI export integration to ensure correct candidate counting and filtering.
- [ ] Verify all fixes with the integration test suite.
