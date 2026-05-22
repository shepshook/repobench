# Task 2.FIX1.3: Mark Epic 2 Success Criteria as Completed

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)  
**Feature:** 2.FIX1 — Global Epic Integration & Alignment Round 1  
**Status:** Pending

---

## Objective
Mark the two unchecked Epic 2 success criteria in ROADMAP.md as `[x]`. Both criteria are functionally implemented across Features 2.1–2.5 but were never formally checked off.

## Context
The ROADMAP.md Epic 2 section (line 100–102) shows:

```
**Success Criteria:**
- [ ] Full Docker isolation with state reproduction via git and `build_command`.
- [ ] Automated resource teardown.
```

Both features are implemented:
1. **Docker isolation with state reproduction**: `Sandbox.init()` (sandbox.ts:100-214) creates Docker containers with repo checkout, runs `buildCommand`, and `switchState()` (sandbox.ts:767-803) performs git-based state switching between pre-fix and post-fix commits.
2. **Automated resource teardown**: `Sandbox.destroy()` (sandbox.ts:741-765) tears down containers and temp directories. `SandboxManager.cleanupOrphanedContainers()` (sandbox-manager.ts:123-162) and `killTimedOutContainers()` (sandbox-manager.ts:164-203) handle automated cleanup.

## Instructions

### Step 1 — Mark success criteria
Edit `.agents/ROADMAP.md`, lines 100-102. Change:
```markdown
- [ ] Full Docker isolation with state reproduction via git and `build_command`.
- [ ] Automated resource teardown.
```
To:
```markdown
- [x] Full Docker isolation with state reproduction via git and `build_command`.
- [x] Automated resource teardown.
```

### Step 2 — Verify
- Read ROADMAP.md lines 97-103 to confirm both checkboxes are `[x]`.
- Run `npm run typecheck && npm run lint && npm test` — all must pass.

## Acceptance Criteria
1. Epic 2 success criteria checklist shows `- [x] Full Docker isolation...` and `- [x] Automated resource teardown.`
2. No other changes to ROADMAP.md outside lines 100-102.
3. Typecheck, lint, and full test suite pass.
