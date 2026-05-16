# Task 1.6.FIX1: Feature Review Alignment Round 1

## Findings from Closer Audit
The tests for Feature 1.6 (Dataset Portability) are failing, indicating that the implementation does not meet the defined success criteria.

### Core Structural Issues
1. **Exporter Filtering**: `JsonlDatasetExporter` is not correctly filtering for only approved and curated candidates. This leads to the export of unwanted data.
2. **Importer Idempotency**: `JsonlDatasetImporter` is failing to prevent duplicate entries. Importing the same file multiple times results in duplicate records in the repository, and existing candidates are being re-saved.
3. **CLI Integration**: The CLI export command is producing output that doesn't match the expected test criteria, likely stemming from the filtering issues mentioned above.

## Required Fixes
- [ ] Update `JsonlDatasetExporter` to strictly filter candidates by `curation.isApproved` and `status === 'curated'`.
- [ ] Implement duplicate detection in `JsonlDatasetImporter` using a unique identifier (e.g., `candidateId` or a composite hash) before calling `repository.save()`.
- [ ] Verify and align CLI export output with the expected JSONL schema and test expectations.

## Verification Plan
- [ ] Run `npm run test` and ensure all 4 failing tests pass.
- [ ] Verify that `npm run typecheck` passes.


## Audit Feedback Round 3
- **FAIL**: The implementation completely ignores the critical bugs identified in Round 2.
- **Data Loss (Still Critical)**: `CandidateRepository.getAll()` continues to access `row.curation_score` (snake_case) while the `dbProxy` in `database.ts` transforms all keys to camelCase (`row.curationScore`). Curation data is not being reconstructed, breaking exporters and importers.
- **Deduplication Bug (Still Present)**: The `candidates` table still has a `UNIQUE` constraint on the `hash` column. Since `JsonlDatasetImporter` maps `postFixHash` to the `hash` column, candidates sharing the same fix hash will overwrite each other regardless of their `id`.
- **Test Bug (Still Present)**: `tests/integration/task-1.6.fix1.test.ts:67` still uses `.split('\\n')` instead of `.split('\n')`, making the test invalid.
- **Verification Failure**: The implementation fails all success criteria.

