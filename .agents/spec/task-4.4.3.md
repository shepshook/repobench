# Task 4.4.3: Integrate SemanticJudge into EvaluatorPipeline

**Goal:** Integrate the semantic judge into the main evaluation pipeline.

**Tasks:**
1. Update `EvaluatorPipeline` to include `LLMSemanticJudge` in the evaluation process.
2. Update the report generation logic to include `SemanticScore` in the final output.

**DoD:**
- Evaluation pipeline runs the semantic judge after binary tests.
- Final report includes binary results + semantic scores.
