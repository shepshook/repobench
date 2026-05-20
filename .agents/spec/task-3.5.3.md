# Task 3.5.3: Integrate CostParser into SessionOrchestrator

## Goal
Integrate the `CostParser` into the session orchestration lifecycle to automatically capture costs during and after agent runs.

## Tasks
- Update `SessionOrchestrator` to initialize and use `CostParser`.
- Ensure cost metrics are persisted alongside session logs.
- Update log reporting to include cost summaries.

## DoD
- `SessionOrchestrator` correctly triggers parsing after session end.
- Costs are correctly associated with the run ID.
