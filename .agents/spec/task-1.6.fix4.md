# Task 1.6.FIX4: Feature Review Alignment Round 4

## Problem Statement
Feature 1.6 (Dataset Portability) fails critical validation and integration tests. Core issues include schema bypass, failed filtering, and broken upsert logic.

## Structural Findings

### 1. Schema Validation Failure
- `CandidateExportSchema` in `src/core/contracts.ts` (or equivalent) is not enforcing required fields.
- Tests in `tests/core/dataset-contracts.test.ts` show that missing commit hashes and curation data do not trigger validation errors.

### 2. Exporter Filtering Issues
- `JsonlDatasetExporter` is exporting candidates that should be filtered out due to missing required fields.
- CLI export reports `0 candidate(s) processed` when candidates exist, indicating a failure in the curation/approval filter logic during export.

### 3. Importer Validation & Robustness
- `JsonlDatasetImporter` is failing to throw errors when critical metadata (`candidateId`, `createdAt`) is missing.
- Missing `postFixHash` is handled silently instead of being flagged as an error.

### 4. Persistence & Upsert Logic
- Importing the same dataset multiple times creates duplicate records instead of performing an upsert. This indicates a failure in the `CandidateRepository` or the importer's use of it.

### 5. Identity Discrepancies
- There is a mismatch between expected and actual `candidateId` formats (e.g., `cur-app` vs `uuid-cur-app`), suggesting inconsistency in how IDs are generated or stored.

## Required Fixes
- [ ] Fix `CandidateExportSchema` to strictly enforce required fields.
- [ ] Update `JsonlDatasetExporter` to use the schema for filtering.
- [ ] Fix `JsonlDatasetImporter` to strictly validate input records.
- [ ] Implement correct upsert logic in `CandidateRepository` to prevent duplicates.
- [ ] Align `candidateId` handling across the portability pipeline.
- [ ] Fix CLI reporting to accurately count processed candidates.

## Verification Plan
- Run `npm run test` and ensure all 13 failing tests in the portability suite pass.
- Verify no regressions in `mine.test.ts`.
