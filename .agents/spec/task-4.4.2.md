# Task 4.4.2: Implement LLMSemanticJudge service

**Goal:** Implement the `LLMSemanticJudge` service that calls the LLM to rate agent code.

**Tasks:**
1. Implement `LLMSemanticJudge` class in `src/core/services/`.
2. Configure LLM prompts for Correctness, Maintainability, and Idiomaticity rating.
3. Handle LLM API calls with appropriate error handling and retries.

**DoD:**
- `LLMSemanticJudge` implements `ISemanticJudge`.
- Service successfully calls LLM and parses the 1-5 scores.
- Error handling covers LLM API failures.
