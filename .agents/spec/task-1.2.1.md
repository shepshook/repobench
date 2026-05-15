# Task 1.2.1: Significance Filter Interface & Strategy

## Context Map
- `src/core/contracts.ts`: Define `ISignificanceFilter` interface.
- `src/core/services/filters/significance-filter.ts`: (To be created) Implementation.

## Technical Directive
1. Add `ISignificanceFilter` interface to `src/core/contracts.ts`:
   ```typescript
   export interface ISignificanceFilter {
     isSignificant(hash: string, files: string[]): Promise<boolean>;
   }
   ```
2. Create `src/core/services/filters/significance-filter.ts`.
3. Implement `BasicSignificanceFilter` implementing `ISignificanceFilter`.
4. The filter should use `simple-git`'s `diff` command to analyze the changes for the commit.
5. **Significance Logic**:
   - A commit is **insignificant** (return `false`) if all changes are only:
     - Whitespace changes.
     - Changes to comments (use a basic regex for common languages like TS/JS).
     - Changes to non-code files (e.g., `.md`, `.txt`).
   - Otherwise, it is **significant** (return `true`).

## DoD
- `ISignificanceFilter` is defined in contracts.
- `BasicSignificanceFilter` is implemented.
- Unit tests in `tests/core/filters/significance-filter.test.ts` verify the logic for whitespace-only, comment-only, and meaningful changes.
