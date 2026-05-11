---
name: repobench-workflow
description: Core workflow to work on RepoBench features using the Agentic Engineering Loop (Decomposition, Delegated TDD, Closure).
---

# Skill: RepoBench Workflow

## Trigger
Use this skill whenever you are tasked with implementing a new feature, fixing a bug, or refactoring code within the RepoBench project.

## The Agentic Engineering Loop (SOP)

### Phase 1: Decomposition (The "Deep Dive")
Before writing any code, you must decompose the request into a hierarchy of work items and present an **Implementation Roadmap** to the user.
1. **Analyze**: Evaluate the feature against the current codebase and the `contracts.ts` file.
2. **Split**: Break the feature into 2-5 **Atomic Tasks**.
3. **Specify**: Write every task using the **Agent-Ready Format**:
    - **Contextual Map**: List of files to read and interfaces to follow.
    - **Atomic Technical Directive**: Step-by-step logic, function signatures, and integration points.
    - **TDD Blueprint**: Specific test cases (Success, Edge, Failure) and the verification command.
    - **Constraints**: "No-Go" zones and pattern requirements.
    - **Definition of Done (DoD)**: A binary checklist (e.g., "tests pass", "typecheck passes").
4. **Link**: Create the tasks as GitHub issues linked to the parent Feature.

### Phase 2: Delegated TDD Execution
For every atomic task, follow this strict loop:
1. **Read**: Consume the "Contextual Map" of the task.
2. **Implementation (Delegated)**: Launch a **General Subagent** to execute the Red $\rightarrow$ Green $\rightarrow$ Refactor cycle. **Commit the changes immediately after a successful test run.**
3. **Critical Review**: Launch the `critical_reviewer` subagent to audit the code changes and the task completion.
4. **Root Cause Analysis (RCA)**: If the review returns a `FAIL` verdict, you MUST perform an RCA and present it to the user before attempting a fix.
5. **Re-Iteration**: If the review returns a `FAIL` verdict (and RCA is completed), return to the implementation step with the reviewer's feedback and RCA results.
6. **Final Verification**: Once the review is `PASS`, run `npm run typecheck` and the specific test command.

### Phase 3: Closure
1. **Commit**: Create a descriptive commit (e.g., `feat: implement X`) and push to the remote.
2. **Close**: Mark the GitHub task and feature as completed.
3. **Update**: If a new pattern or global configuration was introduced, update `AGENTS.md`.

## Interaction Guidelines
- **Conciseness**: Do not explain the code after writing it. Only provide the result and the verification output.
- **Proactiveness**: If a task is trivial, suggest a "Fast-Track" approach to the user, but always provide a test.
- **Honesty**: If a test fails, do not "ignore" it. Analyze the failure and update the implementation or the test.
- **Atomic File Modification**: Minimize the scope of file edits to avoid duplication or corruption errors.


