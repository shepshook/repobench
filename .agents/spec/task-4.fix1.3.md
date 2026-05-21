# Task 4.FIX1.3: Remediate System-Wide Lint Regression — Infrastructure Files

## Priority: HIGH

## Problem
`npm run lint` reports **551 errors** (0 warnings). While the Epic 4 core service code (`src/core/services/evaluator.ts`, etc.) is relatively clean, the infrastructure layer files (PTY, Sandbox, VolumeManager, SandboxManager) are flooded with:
- `@typescript-eslint/no-explicit-any` — pervasive use of `any` type
- `@typescript-eslint/no-unsafe-member-access` — accessing `.message`, `.stderr`, `.stdout`, `.id` etc. on `any`-typed values
- `@typescript-eslint/no-unsafe-assignment` — assigning `any` values to typed variables
- `@typescript-eslint/no-unsafe-call` — calling methods on `any` typed values
- `@typescript-eslint/no-unsafe-argument` — passing `any` values as typed arguments
- `no-empty` — empty catch/if blocks
- `no-unused-vars` — unused variables
- `prefer-const` — variables never reassigned
- `no-undef` — `process`, `console`, `Buffer`, `TextEncoder` not defined (missing env config)

The total count is too high for a single-task fix. This task focuses on the highest-impact, auto-fixable errors and the no-undef/minimum fixes required to bring lint to a tolerable baseline.

## Affected Files (ranked by error count)
1. `src/infrastructure/sandbox.ts` (~85 errors)
2. `src/infrastructure/pty-session.ts` (~45 errors)
3. `src/infrastructure/pty-drivers.ts` (~35 errors)
4. `src/infrastructure/sandbox/sandbox-manager.ts` (~30 errors)
5. `src/infrastructure/volume-manager.ts` (~30 errors)
6. `src/infrastructure/pty/pty-worker.ts` (~15 errors)
7. `src/infrastructure/pty/rca-utils.ts` (~15 errors)
8. `src/infrastructure/pty/virtual-screen.ts` (~4 errors)
9. `src/infrastructure/pty/types.ts` (~2 errors)
10. `src/infrastructure/pty-drivers.ts` (~20 errors, some overlap with #3)
11. Multiple `.js` and `.cjs` files with `no-undef` for `exports`/`console`/`TextDecoder`

## Task

### Phase A: Auto-Fixable (run `npx eslint --fix`)
1. Unused variables (`no-unused-vars`, `prefer-const`) — most are auto-fixable
2. Run `npx eslint --fix src/` and capture remaining errors

### Phase B: Minimum Fixes for Infrastructure Files
3. Add `/* eslint-env node */` or update `.eslintrc` to add `node: true` and `es2022: true` for `.ts` files to fix `no-undef` for `process`, `console`, `Buffer`, `TextEncoder`
4. Add `/* eslint-env node */` to `.cjs` and `.js` files to fix `no-undef` for `exports`, `console`, `TextDecoder`
5. Fix `no-empty` catch blocks (replace with `{ /* intentionally empty */ }` or add error logging)
6. Fix `preserve-caught-error` — add `{ cause: error }` to re-thrown errors in sandbox-manager.ts

### Phase C: Type Safety (Minimal — avoid breaking functionality)
7. Replace `error: any` catch clauses with `error: unknown` and add type guards
8. Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` annotations on Dockerdriver/PTY worker boundary code where `any` is fundamentally necessary due to Dockerode API types

### Phase D: Verification
9. Run `npm run typecheck` (must remain clean)
10. Run `npm test` (no new regressions from lint fixes)
11. Run `npm run lint` and ensure remaining errors ≤ 150 (aggressive target: ≤ 100)

## DoD
- [ ] `no-undef` errors eliminated (0 remaining)
- [ ] `no-empty` errors eliminated (0 remaining)
- [ ] `prefer-const` errors eliminated (0 remaining)
- [ ] `no-unused-vars` errors eliminated (0 remaining)
- [ ] `preserve-caught-error` errors eliminated (0 remaining)
- [ ] Total lint errors ≤ 150
- [ ] TypeScript compilation still passes
- [ ] All tests still pass
