# Task 1.6.3: Implement JSONL DatasetImporter

## Objective
Implement the logic to read a JSONL file and populate the local SQLite database with its candidates.

## Requirements
- **Implementation**: Create `JsonlDatasetImporter` in `src/infrastructure/` implementing `IDatasetImporter`.
- **Persistence**: Use `CandidateRepository` to insert candidates.
- **Idempotency**: Ensure that importing the same file multiple times does not create duplicate candidate entries.
- **Validation**: Basic check to ensure the input file follows the expected JSONL schema before processing.

## Definition of Done
- `JsonlDatasetImporter` is implemented and passes basic unit tests.
- A call to `import()` correctly populates the database from a valid `.jsonl` file.
