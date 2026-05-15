---
name: repobench-workflow
description: High-integrity Engineering Loop with role-separated TDD and multi-layer reviews.
---

# Skill: RepoBench Workflow

## Trigger
Use this whenever you are tasked with a new Epic, Feature, or Bugfix.

## 🛑 Strict Mandates
1. **Hierarchy Discipline**: You MUST process in order: Epic ➔ Feature ➔ Atomic Task.
2. **Strict Execution**: You MUST follow these steps in order without skipping. No task can be marked complete without passing through the full TDD and review loop.
3. **No Self-Audit**: Every task and every completed feature MUST be audited by the `critical_reviewer`.
4. **Persistence**: Use `.agents/spec/task-x.y.z.md` for all task-level directives.
5. **Flaky Subagents**: If a subagent returns an empty response you MUST rerun it. No assumptions allowed.

---

## Phase 1: Decomposition & Plan Audit
1. **Sync**: Read `ROADMAP.md` and `ARCHITECTURE.md`.
2. **Decompose**: Split the active **Feature** into 2-5 **Atomic Tasks**.
3. **Document**: Create `.agents/spec/task-x.y.z.md` for each task. Include:
    - **Context Map**: Relevant interfaces from `contracts.ts` and files.
    - **Technical Directive**: Implementation logic.
    - **DoD**: Specific commands to verify (e.g., `npm run test:task`).
4. **Plan Review**: Before starting, launch `critical_reviewer` to audit the decomposition. 
    - *Focus*: "Does this decomposition cover the full scope of the Feature without logic gaps?"
5. **Link**: Update `ROADMAP.md` with links to these spec files under the feature.

## Phase 2: Separated TDD Execution (The Task Loop)
For each task in the roadmap:

1. **Step A: Test Architecture**:
    - Launch `general` with a "Test-Only" prompt.
    - **Goal**: Write failing tests based on the spec. 
2. **Step B: Implementation**:
    - Launch `general`. 
    - **Constraint**: Provide ONLY the code files and the newly created test files. The implementer MUST NOT touch the tests.
3. **Step C: Task Review**:
    - Launch `critical_reviewer`. 
    - **Audit**: Compare the implementation against the spec and `ARCHITECTURE.md`.
    - **RCA**: If `FAIL`, perform Root Cause Analysis, update the spec file if necessary, and repeat Step B.

## Phase 3: Feature Integration & Closure
Once all tasks for a **Feature** are marked `[x]`:

1. **Feature-Level Review**: 
    - Launch `critical_reviewer` against the **entire feature**.
    - **Focus**: Check for inconsistencies, duplicated logic across tasks, and adherence to `ARCHITECTURE.md`.
2. **Verification**: Run `npm run typecheck` and the full project test suite.
3. **State Update**:
    - Mark Feature as `[x]` in `ROADMAP.md`.
    - If all Features in an Epic are done, mark Epic as `[x]`.
4. **Commit**: `feat(scope): implement feature X`.