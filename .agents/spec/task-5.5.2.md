# Task 5.5.2: Document Runtime Issues and Implement Fixes

**Epic:** 5 — Comparative Analysis & Reporting (The Leaderboard)
**Feature:** 5.5 — End-to-End Pipeline Validation
**Status:** Not Started

---

## Objective
Analyze the runtime issues discovered in Task 5.5.1, categorize them, and implement fixes to make the pipeline fully functional.

## Context
- Task 5.5.1 runs the full pipeline and produces a list of errors, warnings, and unexpected behaviors.
- This task processes that list and creates targeted fixes.
- Issues may span multiple epics (miner parsing, sandbox networking, PTY session, judge evaluation, report formatting).

## Instructions

### Step 1 — Categorize issues
For each issue found in 5.5.1, assign a category:

| Category | Description |
|----------|-------------|
| `BUG` | Code doesn't work as intended (crash, wrong output, hang) |
| `MISSING_FEATURE` | Code path that was never implemented (stub, TODO, or missing integration) |
| `CONFIG` | Configuration issue (wrong yaml, missing env vars, wrong paths) |
| `ENV` | Environment issue (Docker not running, missing npm packages, network) |
| `USABILITY` | Poor UX (cryptic error messages, missing --help, unclear output) |

### Step 2 — Fix BUG issues
For each `BUG`:
- Read the relevant source code in the error's stack trace.
- Identify the root cause.
- Implement the fix.
- Add a regression test if one doesn't exist.
- Verify with `npm run typecheck && npm run lint`.

### Step 3 — Address MISSING_FEATURE issues
For each `MISSING_FEATURE`:
- Determine if it's in scope of the existing feature or requires a new feature/task.
- If in scope, implement it.
- If out of scope, create a new tickler in the roadmap.

### Step 4 — Fix CONFIG issues
For each `CONFIG`:
- Update `repobench.yaml` with correct values.
- Verify config loads correctly.

### Step 5 — Address ENV issues
For each `ENV`:
- Document the required environment setup in README.md and/or AGENTS.md.
- Add a pre-flight check in the CLI if practical.

### Step 6 — Fix USABILITY issues
For each `USABILITY`:
- Improve error messages to include actionable information.
- Add validation where appropriate.

### Step 7 — Re-run pipeline
After fixes:
```bash
node src/cli/index.js mine -r .
node src/cli/index.js run-all -a opencode --concurrency 1 --project repobench
node src/cli/index.js report
```
Verify all previous issues are resolved.

## Acceptance Criteria
1. Every issue from 5.5.1 is categorized and either fixed or documented as a known limitation.
2. `npm run typecheck && npm run lint` passes after all fixes.
3. Full pipeline runs without crashes.
4. `repobench report` displays meaningful data (even if all runs failed for valid reasons).
