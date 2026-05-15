# Task 1.2.1: Significance Filter Interface

## Context Map
- `src/core/contracts.ts`: Central location for all domain interfaces.
- `ARCHITECTURE.md`: Mandates Contract-First development.

## Technical Directive
1. Add the `ISignificanceFilter` interface to `src/core/contracts.ts`.
2. The interface must define a method `isSignificant(hash: string, files: string[]): Promise<boolean>`.
3. **Decision**: A boolean return is sufficient for the MVP to determine if a commit is "noisy" (insignificant) or a candidate for further purity analysis.
4. Ensure the naming follows the `I`-prefix convention.

## DoD
- `ISignificanceFilter` is correctly defined in `src/core/contracts.ts`.
- Code passes `npm run typecheck`.
- Interface is reviewed and approved by `critical_reviewer`.
