# Task 1.6.1: Define Exporter/Importer Contracts & JSONL Schema

## Objective
Establish the formal interfaces and data schema required to export and import RepoBench curated datasets.

## Requirements
- **Contracts**: Define `IDatasetExporter` and `IDatasetImporter` interfaces in `src/core/contracts.ts`.
    - `IDatasetExporter` should have an `export(path: string): Promise<void>` method.
    - `IDatasetImporter` should have an `import(path: string): Promise<void>` method.
- **Schema**: Define a JSONL (JSON Lines) format where each line is a serialized `Candidate` entity. Implement a `zod` schema to validate the format during import/export.
- **Metadata**: Ensure the schema captures:
    - Repository information.
    - Commit hashes (pre-fix, post-fix).
    - Curated reasoning/labels from the LLM.
    - Validation status.

## Definition of Done
- `src/core/contracts.ts` updated with new interfaces.
- JSONL schema documented (either in the spec or a dedicated types file).
