# Task 1.6.FIX7: Fix DatasetImporter Deduplication

## Description
The `JsonlDatasetImporter` is still failing to correctly deduplicate imports, leading to multiple entries in the database for the same candidate ID when importing the same file or overlapping candidates.

## Requirements
- [ ] Investigate why `seenIds` or `repo.upsert` is failing to deduplicate entries.
- [ ] Ensure `JsonlDatasetImporter` correctly handles duplicates within the same import file.
- [ ] Ensure `JsonlDatasetImporter` correctly handles duplicates across different import files (upsert functionality).
- [ ] Update `tests/integration/import-jsonl.test.ts` to include more robust tests for duplication scenarios.
- [ ] Run `npm run test` to verify the fix.
