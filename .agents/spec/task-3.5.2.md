# Task 3.5.2: Implement CostParser Service

## Goal
Implement the `CostParser` service that scans session logs for cost-related patterns.

## Tasks
- Implement `CostParser` class in `src/core/services/cost-parser.ts`.
- Implement regex logic to identify token usage and cost in stdout streams.
- Ensure `CostParser` implements `ICostParser`.

## DoD
- Service can extract cost data from provided test log samples.
- Regexes are extensible for different agent output formats.
