# RalphLoop.ps1 - Hierarchical Ralph Loop Orchestrator
$MaxIterations = 1000
$Iteration = 1
$HighTierModel = "openrouter/deepseek/deepseek-v4-flash"
$MiddleTierModel = "google/gemini-3.1-flash-lite"
$FreeTierModel = "google/gemma-4-31b-it"

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
        if ($EpicBlock -match '(?s)(\*\s*\[ \]\s*Feature\s+(\d+\.\d+(\.\w+)?):.*?)(\*\s*\[|##|\z)') {
            $FeatureBlock = $Matches[1]
            $FeatureID = $Matches[2]
            
            Write-Host "  📍 Active Feature Layer: Feature ${FeatureID}" -ForegroundColor Yellow
            
            # STATE A: DECOMPOSITION CHECK
            if ($FeatureBlock -notmatch '-\s*\[.\]\s*\[Task\s+(.+):') {
                Write-Host "    📂 State: Needs Decomposition..." -ForegroundColor Yellow
                opencode run -m ${MiddleTierModel} "You are the PLANNER. Read @.agents\ROADMAP.md and @.agents\ARCHITECTURE.md. Isolate Feature ${FeatureID} inside Epic ${EpicID}. Decompose it into 2-5 atomic tasks under a '  * **Tasks:**' block. Create .agents/spec/task-${FeatureID}.X.md files for each. Call critical_reviewer to audit the plan. Once PASS, update .agents/ROADMAP.md and EXIT."
                continue
            }

            # STATE B: PENDING TASK CHECK
            if ($FeatureBlock -match '-\s*\[ \]\s*\[Task\s+([\d\.\w]+):') {
                $TaskID = $Matches[1]
                Write-Host "    🧪 State: Task ${TaskID} is Pending. Entering TDD Pipeline..." -ForegroundColor Magenta
                
                # 1. Test Architect
                Write-Host "       > TEST_ARCHITECT generating test assertions..." -ForegroundColor Magenta
                opencode run -m ${FreeTierModel} "You are the TEST_ARCHITECT. Read @.agents\spec\task-${TaskID}.md and @.agents\ARCHITECTURE.md. Write failing integration or unit tests in the tests/ directory for this task. Do NOT touch files in src/. Do NOT duplicate existing tests. EXIT when done."
                
                # 2. Implementer
                Write-Host "       > IMPLEMENTER writing functional logic..." -ForegroundColor Magenta
                opencode run -m ${FreeTierModel} "You are the IMPLEMENTER. Read @.agents\spec\task-${TaskID}.md, @.agents\ARCHITECTURE.md, and the new tests. Modify files in src/ to make the tests pass. Do NOT touch the test files. EXIT when done."
                
                # 3. Task Reviewer
                Write-Host "       > CRITICAL_REVIEWER verifying code compliance..." -ForegroundColor Magenta
                opencode run -m ${MiddleTierModel} "You are the CRITICAL_REVIEWER. Audit Task ${TaskID} against its spec and @.agents\ARCHITECTURE.md and review the code quality. If PASS, rewrite .agents\ROADMAP.md changing '- [ ] [Task ${TaskID}:' to '    - [x] [Task ${TaskID}:'. If FAIL, write precise feedback into the spec file under '## Audit Feedback Round N' (.agents\spec\task-${TaskID}.md) and do NOT check it off. EXIT."
                continue
            }

            # STATE C: FEATURE COMPLETION / INTEGRATION REVIEW
            Write-Host "    🏁 State: All tasks for Feature ${FeatureID} are [x]. Reviewing Feature Integration..." -ForegroundColor Green
            $closerMsg = 
            opencode run -m ${MiddleTierModel} "`"You are the CLOSER. All tasks for Feature ${FeatureID} are checked off, but the Feature line is open. Run full typecheck and test suite. Audit the entire feature scope for architectural drift. If PASS: Update the feature line to '* [x] Feature ${FeatureID}' in .agents/ROADMAP.md. If FAIL: Decompose the findings into atomic tasks if needed and append them to this feature: '    - [ ] [Task ${FeatureID}.FIXN: Audit <Summary> Round X](.agents/spec/task-${FeatureID}.fixn.md)' and write your clear agent-ready instructions to the according spec files. EXIT.`""
            continue
        } else {
            # --- STEP 3: EPIC COMPLETION & REVIEW ---
            # All features for this epic are marked [x], proceed with epic-level review
            Write-Host "🏆 State: All features for Epic ${EpicID} are complete. Launching Epic-Level Review..." -ForegroundColor Blue
            opencode run -m ${MiddleTierModel} "`"You are the PRINCIPAL ARCHITECT. All features for Epic ${EpicID} are marked [x], but the Epic checkbox is open. Evaluate system-wide stability, structural integrity across modules, cross-feature boundary leaks, and total regression logs. If PASS: Update the epic line to '## [x] Epic ${EpicID}' in .agents/ROADMAP.md and run 'git add . && git commit -m "chore: release and close Epic ${EpicID}"'. If FAIL: Append a new alignment feature block to the bottom of this Epic: '* [ ] Feature ${EpicID}.FIXN: Global Epic Integration & Alignment Round N'. Decompose your findings into atomic tasks if needed and append them to this feature: '    - [ ] [Task ${EpicID}.FIXN.I: Epic Audit <Summary> Round N](.agents/spec/task-${EpicID}.fixn.i.md)' and write your clear agent-ready instructions to the according spec files. EXIT.`""
            continue
        }
    } else {
        Write-Host "🎉 All Epics in .agents/ROADMAP.md are marked [x]! System completely implemented." -ForegroundColor Green
        break
    }

    $Iteration++
    Start-Sleep -Seconds 2
}
