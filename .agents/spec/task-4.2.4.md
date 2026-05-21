# Spec: Task 4.2.4: Integrate SearchEfficiencyTracker into EvaluatorPipeline
Goal: Integrate the `SearchEfficiencyTracker` into the `Judge` module.
Implementation Details:
- Initialize/close the tracker per agent session in `EvaluatorPipeline`.
- Ensure metrics are integrated into run results reporting.
