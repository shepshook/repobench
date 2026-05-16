# Task 1.6.2: Implement JSONL DatasetExporter

## Objective
Implement the logic to extract curated candidates from the local SQLite database and save them to a JSONL file.

## Requirements
- **Implementation**: Create `JsonlDatasetExporter` in `src/infrastructure/` implementing `IDatasetExporter`.
- **Data Source**: Use `CandidateRepository` to fetch all curated candidates.
- **Serialization**: Use the JSONL format defined in Task 1.6.1.
- **Error Handling**: Wrap file system operations in try/catch and provide descriptive error messages (per ARCHITECTURE.md).


## Definition of Done
- `JsonlDatasetExporter` is implemented and passes basic unit tests.
- A call to `export()` produces a valid `.jsonl` file containing all database candidates.

## Audit Feedback
- FAIL: The implementation of `JsonlDatasetExporter` still uses hardcoded placeholders (e.g., `'https://github.com/repobench/default'`, `'default-prefix-hash'`) instead of using the data available in the `Candidate` object.
- The exporter fetches all candidates using `repo.getAll()` instead of filtering for curated and approved candidates as required.
- It does not validate that required fields for `CandidateExport` are present before exporting, filling them with defaults instead.

