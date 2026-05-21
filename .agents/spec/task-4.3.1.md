# Task 4.3.1: Define IScorer Interface and E-Score Formula Contract

## Description
Define the `IScorer` interface and the contract for the E-Score calculation formula.

## Specification
- Define `IScorer` interface in `src/core/contracts.ts` (or relevant location if different).
- Define `EScoreFormula` type or function signature based on $E\text{-Score} = \frac{\text{Success}}{\text{Cost} \times \log(\text{Latency})} \times \text{Efficiency\_Multiplier}$.
- Ensure `Success`, `Cost`, `Latency`, and `Efficiency_Multiplier` are well-defined in the domain model.

## DoD
- Interface and formula contract are defined, typed, and integrated into the core contracts.
