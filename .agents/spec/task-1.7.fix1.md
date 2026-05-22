
1: # Task 1.7.FIX1: Populate preFixHash/postFixHash in GitMiner Output
2: 
3: **Epic:** 1 — Git-Based Benchmark Generation (The Miner)
4: **Feature:** 1.7 — CLI Integration & Config Readiness
5: **Status:** Fixes Applied — Awaiting Round 2 Audit
6: 
7: ---
8: 
9: ## Objective
10: Fix the `GitMiner` to populate `preFixHash` and `postFixHash` on every `Candidate` it creates. Currently these fields are omitted, causing the Evaluator (and other downstream consumers) to crash with "Candidate missing preFixHash" or "Candidate missing postFixHash".
11: 
12: ## Context
13: - `Candidate` schema (`src/core/contracts.ts:53-54`) has `preFixHash` and `postFixHash` as optional fields.
14: - The Evaluator (`src/core/services/evaluator.ts:49-58`) requires both and throws if missing:
15:   ```typescript
16:   if (!candidate.preFixHash) throw new Error('Candidate missing preFixHash');
17:   if (!candidate.postFixHash) throw new Error('Candidate missing postFixHash');
18:   ```
19: - The `FailureArtifactExporter` and `JsonlDatasetExporter` also reference `preFixHash`/`postFixHash`.
20: - The git convention is: `postFixHash` = the fix commit hash, `preFixHash` = the parent commit hash.
21: 
22: ## Instructions
23: 
24: ### Step 1 — Get parent hash for each commit
25: In `src/core/services/miner.ts`, within the commit processing loop (around line 108, before creating the candidate), retrieve the parent commit hash:
26: 
27: ```typescript
28: // Use git rev-parse to get parent hash
29: let preFixHash: string | undefined;
30: try {
31:   const parentResult = await git.raw(['rev-parse', `${commit.hash}^`]);
32:   preFixHash = parentResult.trim();
33: } catch {
34:   // If no parent exists (root commit), skip or set undefined
35:   preFixHash = undefined;
36: }
37: ```
38: 
39: ### Step 2 — Set fields on candidate
40: Modify the candidate creation block (lines 109-118) to include both hashes:
41: 
42: ```typescript
43: const candidate: Candidate = {
44:   id: crypto.randomUUID(),
45:   hash: commit.hash,
46:   message: commit.message,
47:   files,
48:   status: 'pending',
49:   created_at: new Date(),
50:   repositoryUrl,
51:   repositoryName,
52:   postFixHash: commit.hash,
53:   preFixHash,  // parent hash (undefined for root commits)
54: };
55: ```
56: 
57: ### Step 3 — Verify
58: - Run `npm run typecheck` — must pass.
59: - Run `npm run lint` — must pass.
60: - Run `npm test` — all tests must pass.
61: 
62: ## Acceptance Criteria
63: 1. `GitMiner` populates `postFixHash` with the commit hash on every created candidate.
64: 2. `GitMiner` populates `preFixHash` with the parent commit hash (via `git rev-parse hash^`) on every created candidate that has a parent.
65: 3. `preFixHash` is `undefined` (omitted) only for root commits with no parent.
66: 4. Typecheck, lint, and full test suite pass.
67: 
68: ## ESCALATION DIRECTIVE

**Root Cause of Stuck State:** Both Round 1 audit failures were fixed in the working tree, but the spec status and ROADMAP.md were never reconciled. No Round 2 review was requested/logged.

### Fixes Already Applied (verify with `git diff`)

| # | Audit Failure | Resolution | File |
|---|--------------|------------|------|
| 1 | Unused `_writtenCommands` param in `ansi-processor.ts` | Removed the unused parameter from `normalize()` signature | `src/infrastructure/ansi-processor.ts:31` |
| 2 | Missing unit tests for `preFixHash`/`postFixHash` | Added 3 tests | `tests/core/miner.test.ts:273-328` |

### Implementation (`src/core/services/miner.ts:109-129`)
- `postFixHash` = `commit.hash`
- `preFixHash` = parent hash via `git rev-parse ${commit.hash}^` (undefined for root commits)

### Verification
```
npm run typecheck  ✓  |  npm run lint  ✓  |  miner tests 13/13 ✓  |  integration mine 2/2 ✓
```

### Next Steps
1. Confirm no regressions.
2. Update ROADMAP.md: `[ ] Task 1.7.FIX1` -> `[x] Task 1.7.FIX1`.
3. Commit changes or close the task.

---

## Audit Feedback Round 1
69: - FAIL: `npm run lint` failed due to unused variable `_writtenCommands` in `src/infrastructure/ansi-processor.ts`.
70: - FAIL: Missing unit tests verifying `preFixHash` and `postFixHash` population in `GitMiner` candidates.
