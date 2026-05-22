# RalphLoop.ps1 - Hierarchical Ralph Loop Orchestrator
$MaxIterations = 1000
$Iteration = 1
$ProTierModel = "deepseek/deepseek-v4-pro"
$HighTierModel = "deepseek/deepseek-v4-flash"
$MiddleTierModel = "google/gemini-3.1-flash-lite"
$FreeTierModel = "google/gemma-4-31b-it"
$StateFile = Join-Path $PSScriptRoot ".agents\.ralph-state.json"

function Get-TaskAttempts {
    param([string]$taskId)
    if (Test-Path $StateFile) {
        $data = Get-Content $StateFile -Raw | ConvertFrom-Json
        $task = $data.tasks | Where-Object { $_.id -eq $taskId }
        if ($task) { return $task.attempts }
    }
    return 0
}

function Increment-TaskAttempt {
    param([string]$taskId)
    $data = @{ tasks = @() }
    if (Test-Path $StateFile) {
        $data = Get-Content $StateFile -Raw | ConvertFrom-Json
    }
    $task = $data.tasks | Where-Object { $_.id -eq $taskId }
    if (-not $task) {
        $task = [PSCustomObject]@{ id = $taskId; attempts = 0 }
        $data.tasks += $task
    }
    $task.attempts++
    $data | ConvertTo-Json -Depth 10 | Set-Content $StateFile
    return $task.attempts
}

function Reset-TaskAttempt {
    param([string]$taskId)
    if (Test-Path $StateFile) {
        $data = Get-Content $StateFile -Raw | ConvertFrom-Json
        $task = $data.tasks | Where-Object { $_.id -eq $taskId }
        if ($task) { $task.attempts = 0 }
        $data | ConvertTo-Json -Depth 10 | Set-Content $StateFile
    }
}

Write-Host "🚀 Starting Hierarchical RepoBench Ralph Loop..." -ForegroundColor Cyan

while ($Iteration -le $MaxIterations) {
    # Read fresh on-disk state
    $Roadmap = Get-Content ".agents/ROADMAP.md" -Raw
    
    # --- STEP 1: ISOLATE THE FIRST OPEN EPIC ---
    if ($Roadmap -match '(?s)(##\s*\[ \]\s*Epic\s+(\d+):.*?)(##\s*\[|\z)') {
        $EpicBlock = $Matches[1]
        $EpicID = $Matches[2]
        
        Write-Host "🏛️ Active Epic Layer: Epic ${EpicID}" -ForegroundColor Cyan

        # --- STEP 2: ISOLATE THE FIRST OPEN FEATURE INSIDE THIS EPIC ---
        if ($EpicBlock -match '(?s)(\*\s*\[ \]\s*Feature\s+(\d+\.\w+(\.\w+)*):.*?)(\*\s*\[|##|\z)') {
            $FeatureBlock = $Matches[1]
            $FeatureID = $Matches[2]
            
            Write-Host "  📍 Active Feature Layer: Feature ${FeatureID}" -ForegroundColor Yellow
            
            # STATE A: DECOMPOSITION CHECK
            if ($FeatureBlock -notmatch '-\s*\[.\]\s*\[Task\s+(.+):') {
                Write-Host "    📂 State: Needs Decomposition..." -ForegroundColor Yellow
                opencode run -m ${HighTierModel} "You are the PLANNER. Read @.agents\ROADMAP.md and @.agents\ARCHITECTURE.md. Isolate Feature ${FeatureID} inside Epic ${EpicID}. Decompose it into 2-5 atomic tasks under a '  * **Tasks:**' block. Create .agents/spec/task-${FeatureID}.X.md files for each. Call critical_reviewer to audit the plan. Once PASS, update .agents/ROADMAP.md and EXIT."
                continue
            }

            # STATE B: PENDING TASK CHECK
            if ($FeatureBlock -match '-\s*\[ \]\s*\[Task\s+([\d\.\w]+):') {
                $TaskID = $Matches[1]
                $taskAttempts = Get-TaskAttempts $TaskID
                Write-Host "    🧪 State: Task ${TaskID} is Pending. (Attempt $($taskAttempts + 1))" -ForegroundColor Magenta

                # ESCALATION: after 2 failed reviews, escalate to premium model
                if ($taskAttempts -ge 2) {
                    Write-Host "       ⚠️ Task ${TaskID} has failed review $taskAttempts times. Escalating to premium model..." -ForegroundColor Red
                    opencode run -m ${HighTierModel} "You are the ARCHITECTURAL ESCALATION ENGINE. Read @.agents\ROADMAP.md (feature context), @.agents\spec\task-${TaskID}.md (all audit feedback rounds), and @.agents\ARCHITECTURE.md. Determine why Task ${TaskID} is stuck after ${taskAttempts} failed review attempts. Decide: (A) Continue — append '## ESCALATION DIRECTIVE' to @.agents\spec\task-${TaskID}.md with precise fix instructions. (B) Refactor — append '## ESCALATION: REFACTOR' with a refactor plan. (C) Blocked — append '## ESCALATION: BLOCKED' AND write 'BLOCKED' to .agents\.ralph-halt. EXIT."
                    if (Test-Path ".agents\.ralph-halt") {
                        Write-Host "       🛑 Escalation declared task BLOCKED. Halting." -ForegroundColor Red
                        Get-Content ".agents\.ralph-halt" -Raw | Write-Host -ForegroundColor Red
                        break
                    }
                    Write-Host "       ✓ Escalation completed. Continuing with directive." -ForegroundColor Green
                }

                # 1. Test Architect
                Write-Host "       > TEST_ARCHITECT generating test assertions..." -ForegroundColor Magenta
                opencode run -m ${HighTierModel} "You are the TEST_ARCHITECT. Read @.agents\spec\task-${TaskID}.md and @.agents\ARCHITECTURE.md and follow the described testing principles. Review the existing tests before adding new. Write failing integration or unit tests in the tests/ directory for this task if they don't introduce overlap with existing tests. Do NOT touch files in src/. EXIT when done."

                # 2. Implementer — MUST address all review feedback
                Write-Host "       > IMPLEMENTER writing functional logic..." -ForegroundColor Magenta
                opencode run -m ${HighTierModel} "You are the IMPLEMENTER. Read @.agents\spec\task-${TaskID}.md (pay CLOSE attention to ALL '## Audit Feedback Round' and '## ESCALATION' sections — fix every unresolved issue), @.agents\ARCHITECTURE.md, and the new tests. Modify files in src/ to make the tests pass. Do NOT touch the test files. EXIT when done."

                # 3. Task Reviewer
                Write-Host "       > CRITICAL_REVIEWER verifying code compliance..." -ForegroundColor Magenta
                opencode run -m ${MiddleTierModel} "You are the CRITICAL_REVIEWER. Audit Task ${TaskID} against its spec and @.agents\ARCHITECTURE.md and review the code quality. If PASS, rewrite .agents\ROADMAP.md changing '- [ ] [Task ${TaskID}:' to '    - [x] [Task ${TaskID}:'. If FAIL, write down precise feedback into the spec file under '## Audit Feedback Round N' (.agents\spec\task-${TaskID}.md) and do NOT check it off. EXIT."

                # Check PASS/FAIL and commit if passed
                $RoadmapAfter = Get-Content ".agents/ROADMAP.md" -Raw
                $escapedId = $TaskID -replace '\.', '\.'
                if ($RoadmapAfter -match "\[x\]\s*\[Task\s+${escapedId}:") {
                    Write-Host "       ✓ Task ${TaskID} passed review. Committing..." -ForegroundColor Green
                    Reset-TaskAttempt $TaskID
                    git add -A
                    git commit -m "feat: complete Task ${TaskID}"
                } else {
                    $newCount = Increment-TaskAttempt $TaskID
                    Write-Host "       ✗ Task ${TaskID} failed review (attempt $newCount). Feedback written to spec." -ForegroundColor Yellow
                }
                continue
            }

            # STATE C: FEATURE COMPLETION / INTEGRATION REVIEW
            Write-Host "    🏁 State: All tasks for Feature ${FeatureID} are [x]. Reviewing Feature Integration..." -ForegroundColor Green
            $closerMsg = 
            opencode run -m ${HighTierModel} "`"You are the CLOSER. All tasks for Feature ${FeatureID} are checked off, but the Feature line is open. Run full typecheck and test suite. Audit the entire feature scope for architectural drift AND cross-feature integration boundaries (check ARCHITECTURE.md §7.1 for what this feature produces and who consumes it — verify the contract is actually consumable). Review the implementation compliance against the spec and evaluate the feature's readiness. If PASS: Update the feature line to '* [x] Feature ${FeatureID}' in .agents/ROADMAP.md. If FAIL: Decompose the findings into atomic tasks if needed and append them to this feature: '    - [ ] [Task ${FeatureID}.FIXN: Audit <Summary> Round X](.agents/spec/task-${FeatureID}.fixn.md)' and write your clear agent-ready instructions to the according spec files. EXIT.`""
            continue
        } else {
            # --- STEP 3: EPIC COMPLETION & REVIEW ---
            # All features for this epic are marked [x], proceed with epic-level review
            Write-Host "🏆 State: All features for Epic ${EpicID} are complete. Launching Epic-Level Review..." -ForegroundColor Blue
            opencode run -m ${ProTierModel} "`"You are the PRINCIPAL ARCHITECT. All features for Epic ${EpicID} are marked [x], but the Epic checkbox is open. Evaluate system-wide stability, structural integrity across modules, cross-feature boundary leaks, and total regression logs. Evaluate the epic's implementation compliance with the documentation and its readiness.

**Integration Checklist (ARCHITECTURE.md §7):**
1. Check that all CLI commands belonging to this epic are registered in src/cli/index.ts (run node src/cli/index.js --help to verify).
2. Check that required configuration files (repobench.yaml) exist for any module in this epic.
3. Verify that the epic's outputs are consumable by downstream epics (e.g., Miner produces candidates → Evaluator reads them; Sandbox provides shell → Session uses it).
4. Verify that no required runtime dependency is missing (e.g., Docker for sandbox, npm packages for agents).
5. Run the epic's relevant CLI command(s) at least with --help to confirm they parse correctly.

If PASS: Update the epic line to '## [x] Epic ${EpicID}' in .agents/ROADMAP.md and run 'git add . && git commit -m "chore: release and close Epic ${EpicID}"'. If FAIL: Append a new alignment feature block to the bottom of this Epic: '* [ ] Feature ${EpicID}.FIXN: Global Epic Integration & Alignment Round N'. Decompose your findings into atomic tasks if needed and append them to this feature: '    - [ ] [Task ${EpicID}.FIXN.I: Epic Audit <Summary> Round N](.agents/spec/task-${EpicID}.fixn.i.md)' and write your clear agent-ready instructions to the according spec files. EXIT.`""
            continue
        }
} else {
    # FINAL MVP REVIEW PHASE
    Write-Host "🔍 All Epics checked. Launching Final MVP Review..." -ForegroundColor Blue
    opencode run -m ${ProTierModel} "You are the FINAL MVP AUDITOR. Review the entire implementation against @.agents\ROADMAP.md and @.agents\ARCHITECTURE.md. Evaluate if the system is complete, stable, and production-ready.

    Apply the Pre-Flight Checklist from ARCHITECTURE.md §7.4:
    1. CLI completeness: Run 'node src/cli/index.js --help'. Every command (mine, export, import, evaluate, run-all, report, export-failures) must appear.
    2. Config existence: Check that repobench.yaml exists with mining keywords, build/test commands, and base image.
    3. Tool installation: Verify SandboxConfig supports agentSetupCommands and they execute inside the container (check src/infrastructure/sandbox.ts and src/core/config.ts).
    4. End-to-end flow: Trace the pipeline manually — can a user run mine, then evaluate, then run-all, then report, then export-failures? Identify any missing wiring (unregistered commands, unconnected modules, missing imports).
    5. Error surface: Search for empty 'catch { }' blocks across src/. Every catch must log or act.
    6. Regression: Typecheck, lint, and test suite must pass.

    Decide:
    (A) PASS: All 6 checks pass. Add '## [x] MVP FINALIZED' to the bottom of .agents\ROADMAP.md and EXIT.
    (B) FAIL: One or more checks failed. For each issue:
        1. Identify the relevant Epic number (e.g., 3).
        2. Uncheck the Epic line (change '## [x] Epic X' to '## [ ] Epic X').
        3. Add a new Feature '* [ ] Feature <EpicNumber>.FIXN: <Summary>' under that Epic.
        4. Decompose the feature into atomic tasks and write their specs in .agents\spec\task-<EpicNumber>.FIXN.Y.md.
        5. Update .agents\ROADMAP.md.
    EXIT."

    $RoadmapAfter = Get-Content ".agents/ROADMAP.md" -Raw
    if ($RoadmapAfter -match '##\s*\[x\]\s*MVP\s*FINALIZED') {
        Write-Host "🎉 MVP FINALIZED! System is production-ready." -ForegroundColor Green
        break
    }
    Write-Host "⚠️ Final Review found gaps. Returning to Ralph Loop for remediation..." -ForegroundColor Yellow
}

    $Iteration++
    Start-Sleep -Seconds 2
}
