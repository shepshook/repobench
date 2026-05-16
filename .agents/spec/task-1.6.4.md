# Task 1.6.4: CLI Integration for Dataset Portability

## Objective
Provide a user-friendly command-line interface to trigger the export and import of datasets.

## Requirements
- **Commands**: Add the following commands to the CLI:
    - `repobench export <path>`: Exports the current curated dataset to the specified path.
    - `repobench import <path>`: Imports a dataset from the specified path.
- **User Feedback**:
    - Success messages indicating the number of candidates processed.
    - Clear error messages for missing files or invalid formats.
- **Integration**: Connect the CLI commands to the `JsonlDatasetExporter` and `JsonlDatasetImporter` implementations.


## Definition of Done
- `repobench export` and `repobench import` are functional.
- CLI output is concise and informative.

## Audit Feedback
- FAIL: CLI commands `repobench export` and `repobench import` are missing.
- FAIL: `src/cli/index.ts` (referenced in `package.json`) does not exist.
- FAIL: No integration with `JsonlDatasetExporter` or `JsonlDatasetImporter` in the CLI.
