# Task 1.4.2: OpenAICurationService Implementation

## Context
- **Module**: Miner
- **Affected Files**: `src/core/services/curation-service.ts` (New), `src/core/contracts.ts`

## Technical Directive
- Implement `OpenAICurationService` which implements `ICurationService`.
- Must use `gpt-4o-mini` (configured via environment variable).
- Prompts must be externalized/configurable.
- Include robust error handling: retry logic for API failures, handle malformed LLM responses/JSON parsing errors.
- Adhere to `contracts.ts`.

## DoD
- Implementation complete and adheres to `ICurationService`.
- Unit tests verify logic with mocked LLM response, including failure scenarios (API error, JSON error).
