# Task 1.6.FIX3: Feature Review Alignment Round 3

## Findings from Closure Audit

The following regressions and structural failures were identified during the final feature audit for Feature 1.6 (Dataset Portability).

### 1. Export Filtering Logic
- **Issue:** The `JsonlDatasetExporter` and the associated CLI command are not correctly filtering candidates by status.
- **Expected:** Only candidates with status `curated` (and potentially `approved`) should be exported.
- **Actual:** Tests indicate that candidates with other statuses are being included, or the filtering logic is returning an empty set when it should not.

### 2. Import Upsert Logic
- **Issue:** `JsonlDatasetImporter` is creating duplicate records in the database instead of updating existing ones.
- **Expected:** Importing a JSONL file should perform an "upsert" based on the candidate ID.
- **Actual:** Duplicate entries are created for the same candidate ID upon multiple imports.

### 3. CLI Export Reporting
- **Issue:** The CLI output for the export command reports an incorrect count of processed candidates.
- **Expected:** The count should accurately reflect the number of candidates written to the file.
- **Actual:** Reports 0 or an incorrect number of candidates processed.

## Requirements for Fix
- [ ] Fix `JsonlDatasetExporter` filtering to strictly adhere to "curated" status.
- [ ] Implement proper upsert logic in `JsonlDatasetImporter` using `better-sqlite3`'s `INSERT OR REPLACE` or similar mechanism.
- [ ] Ensure CLI export command accurately counts and reports the number of exported records.
- [ ] Verify all tests in `tests/integration/export-jsonl.test.ts`, `tests/integration/import-jsonl.test.ts`, and `tests/integration/cli-portability.test.ts` pass.
