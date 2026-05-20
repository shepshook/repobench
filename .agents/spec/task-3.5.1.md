# Task 3.5.1: Define CostParser Contract & Schema

## Goal
Define the interface and data models required for extracting token and cost metrics from agent logs.

## Tasks
- Define `ICostParser` interface in `src/core/contracts.ts` (or relevant contract file).
- Define `CostMetrics` entity in `src/core/entities/`.
- Establish the regex or parsing rules schema for known agent outputs (Aider/ClaudeCode).

## DoD
- Interface is defined and exported.
- Data structures are typed with Zod (as per project conventions).
