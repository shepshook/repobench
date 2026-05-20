---
name: structured-task-workflow
description: Generates a PowerShell workflow script tailored to a specific task and roadmap. The script enforces a strict multi-phase process (plan → implement TDD → review close) and can be re-run with fresh context for stateless, deterministic execution.
---

# Skill: Structured Task Workflow (Script Generator)

## Purpose

This skill does NOT provide workflow instructions for the agent to follow. Instead, it instructs the agent to **generate a PowerShell script** (`.ps1`) that implements the structured-task-workflow for a **specific task and roadmap**.

The generated script is a self-contained, state-tracked executable that enforces the process deterministically — no reliance on agent context or memory.

---

## Workflow Model (what the generated script enforces)

### Phase 1: Decompose (role: Planner+Tester+Implementer)
- Break the task into atomic sub-tasks
- Create plan artifact with `[ ]` checkboxes
- Call `critical_reviewer` to audit the plan
- Only proceed on `PASS`

### Phase 2: Implement (role: Planner+Tester+Implementer)
- For each sub-task: write tests → implement → run checks
- Relaxed TDD: tests may be adjusted if spec is wrong
- On stuck: call `consult`

### Phase 3: Review & Close (role: Reviewer+Closer)
- Call `critical_reviewer` for full code review
- On `FAIL`: re-open sub-task, return to Phase 2
- On `PASS`: mark done, run final checks, commit

---

## Agent Instructions: How to Generate the Script

When invoked with a task description and roadmap/context, you MUST:

### Step 1: Analyze
1. Read the task description and roadmap/plan files.
2. Decompose the task into 2–5 atomic sub-tasks.
3. Determine the correct ordering and dependencies.

### Step 2: Generate the Workflow Script
1. Create `.agents/workflows/<task-name>.ps1`.
2. Use `reference/workflow-template.ps1` as the base.
3. Customize the following sections for the specific task:
   - `$script:taskDescription` — the high-level task
   - `$script:subTasks` — the decomposed sub-tasks with IDs and descriptions
   - `$script:planArtifact` — path to the plan/spec file
   - `$script:targetFiles` — files this task will create/modify
   - Sub-agent invocations within each phase function to include task-specific context
4. Ensure the script is self-contained (no external dependencies beyond opencode CLI).

### Step 3: Validate
1. Verify the script passes `Set-StrictMode -Version Latest`.
2. Verify all sub-task entries match the decomposition.
3. Verify state file paths use the correct workflow name.

### Step 4: Explain
1. Print the script location and sub-task breakdown.
2. Tell the user to run: `.\<script-name>.ps1` or `.\<script-name>.ps1 -Phase 2` to resume.

---

## Script Design Contract

Every generated script MUST follow this contract:

| Element | Convention |
|---|---|
| State file | `.agents/workflows/<script-basename>-state.json` |
| State schema | JSON with: `phase`, `subTaskIndex`, `subTasks[]`, `reviewStatus`, `artifacts[]` |
| Entry point | `.\script.ps1` (default resume) or `.\script.ps1 -Phase 1\|2\|3` |
| Sub-agent call | `opencode run "<prompt>" --agent <agent> --file <context-file>` |
| Verbose output | `Write-Verbose` throughout, controlled by `-Verbose` common param |
| Error handling | `try/catch` with `Write-Error` and non-zero exit code |
| Strict mode | `Set-StrictMode -Version Latest` at top |
