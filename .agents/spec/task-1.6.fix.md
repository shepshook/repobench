# Task 1.6.FIX: Feature Review Alignment

## Findings
The closing audit of Feature 1.6 revealed several regressions in the Dataset Portability implementation.

### 1. Exporter Filtering Logic
- **Issue:** `JsonlDatasetExporter` is failing to export candidates with the `validated` status.
- **Evidence:** `tests/integration/export-jsonl.test.ts` and `tests/integration/cli-portability.test.ts` both report 0 candidates processed when at least one validated candidate is expected.
- **Impact:** Data loss during export; CLI export command is effectively broken.

### 2. Importer Duplication
- **Issue:** `JsonlDatasetImporter` is inserting records without verifying existence or handling duplicates.
- **Evidence:** `tests/integration/import-jsonl.test.ts` expected 2 candidates but found 3 after import.
- **Impact:** Database pollution and inconsistent state when re-importing datasets.

## Required Fixes
- [ ] Audit `JsonlDatasetExporter` filtering logic to ensure `validated` candidates are correctly identified and included.
- [ ] Update `JsonlDatasetImporter` to use an upsert mechanism (INSERT OR REPLACE) based on the candidate's unique ID to prevent duplicates.
- [ ] Verify all integration tests pass before marking Feature 1.6 as complete.
