---
name: repobench-workflow
description: State-based Engineering Loop for PowerShell Orchestration.
---

# Skill: RepoBench Workflow (Ralph Edition)

## 🛑 Ralph Loop Mandates
1. **Statelessness**: Assume you have NO memory of previous tasks. Always start by reading `ROADMAP.md` and the relevant `.agents/spec/` file.
2. **Role Locking**:
   - **Planner**: Only creates specs and updates Roadmap.
   - **Test Architect**: Only writes/edits `tests/`.
   - **Implementer**: Only writes/edits `src/`.
   - **Reviewer**: Only reads code and writes feedback/status.
3. **Atomic Commits**: Only the **Closer** role is allowed to perform `git commit`.

## Phase 1: On-the-Go Decomposition
- **Input**: A Feature marked `[ ]` with no sub-tasks.
- **Action**: 
  - Create 2-5 atomic tasks in `.agents/spec/task-x.y.z.md`.
  - **Plan Audit**: Call `critical_reviewer` subagent to verify the logic flow.
  - **Output**: Roadmap updated with task links; specs saved to disk.

## Phase 2: Separated TDD (The Handover)
- **Test Architect**: Creates the "Objective Reality." Must write edge cases and failure modes.
- **Implementer**: Must pass the tests without modifying them. If the tests are "wrong," the implementer must fail and let the **Reviewer** decide.
- **Reviewer**: 
  - If `FAIL`: You MUST provide high-signal feedback in the spec file under a `## Review Feedback` header so the **Implementer** sees it in the next loop.
  - If `PASS`: Update the Roadmap `[ ]` to `[x]`.

## Phase 3: Feature & Epic Closure
- **Feature Review**: Once all tasks are `[x]`, check for cross-task pollution or naming drifts.
- **Hierarchy Cleanup**:
  - All Tasks `[x]` $\rightarrow$ Feature `[x]`.
  - All Features `[x]` $\rightarrow$ Epic `[x]`.