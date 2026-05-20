<#
.SYNOPSIS
    Structured Workflow: <Task Name>
.DESCRIPTION
    Enforces a 3-phase workflow (Decompose > Implement TDD > Review Close)
    for: <high-level task description>

    State is persisted to <script-basename>-state.json for resume support.
.PARAMETER Phase
    Which phase to run: 1 (Decompose), 2 (Implement), 3 (Review & Close).
    Default: auto-resume from state file.
.PARAMETER Force
    Re-run a completed phase from scratch.
.EXAMPLE
    .\<script-name>.ps1
    .\<script-name>.ps1 -Phase 2 -Verbose
#>

param(
    [ValidateSet(1, 2, 3)]
    [int]$Phase,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ===================================================================
# TASK CONFIGURATION
# AGENT: customize these for the specific task
# ===================================================================

$script:taskDescription = "<high-level task description>"
$script:planArtifact     = ".agents/plans/<task-name>.md"
$script:targetFiles      = @(
    # AGENT: list files this task will create or modify
)

$script:subTasks = @(
    # AGENT: decompose into 2-5 atomic sub-tasks
    # Each entry: @{ id = "1.1"; description = "what to do"; done = $false }
)

# AGENT: customize the planning prompt
$script:planningPrompt = @"
Create a detailed plan for: $($script:taskDescription)

Context files: $($script:targetFiles -join ', ')

The plan must include:
- Context map (relevant files and interfaces)
- Technical directive (step-by-step implementation)
- Testing requirements (edge cases, failure modes)
- Acceptance criteria

Output the plan to: $($script:planArtifact)
"@

# AGENT: customize the implementation prompt template
$script:implementPromptTemplate = @"
Sub-task: {subTaskId} - {subTaskDescription}

Plan reference: {planArtifact}

Instructions:
1. Write tests first (relaxed TDD - may adjust if spec is wrong)
2. Implement to pass tests
3. Run typecheck and lint
4. Do NOT mark done until all checks pass
"@

# ===================================================================
# STATE MANAGEMENT
# ===================================================================

$script:stateFile = Join-Path -Path ".agents\workflows" -ChildPath (
    "$([System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Name))-state.json"
)

function Get-WorkflowState {
    if (Test-Path -LiteralPath $script:stateFile) {
        $state = Get-Content -Raw -LiteralPath $script:stateFile | ConvertFrom-Json
        Write-Verbose "Loaded state from $($script:stateFile)"
        return $state
    }
    Write-Verbose "No state file found, initializing fresh state"
    return Initialize-WorkflowState
}

function Initialize-WorkflowState {
    $subTaskObjects = $script:subTasks | ForEach-Object {
        [PSCustomObject]@{
            id          = $_.id
            description = $_.description
            done        = $false
        }
    }

    $state = [PSCustomObject]@{
        phase        = 0
        subTaskIndex = 0
        subTasks     = $subTaskObjects
        reviewStatus = $null
        artifacts    = @()
        planCreated  = $false
        lastUpdated  = (Get-Date).ToString("o")
    }
    Save-WorkflowState $state
    return $state
}

function Save-WorkflowState($state) {
    $state.lastUpdated = (Get-Date).ToString("o")
    $dir = Split-Path -Parent $script:stateFile
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $state | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $script:stateFile -Encoding utf8
    Write-Verbose "Saved state to $($script:stateFile)"
}

# ===================================================================
# AGENT INVOCATION
# ===================================================================

function Invoke-SubAgent {
    param(
        [Parameter(Mandatory)]
        [string]$Agent,
        [Parameter(Mandatory)]
        [string]$Prompt,
        [string[]]$Files
    )

    $argsList = @("run", "--agent", $Agent, "--format", "json", "--", $Prompt)
    foreach ($f in $Files) {
        if (Test-Path -LiteralPath $f) {
            $argsList += "--file"
            $argsList += $f
        }
    }

    Write-Verbose "Calling sub-agent '$Agent'..."
    Write-Verbose "opencode $($argsList -join ' ')"

    $output = & "opencode" $argsList 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        Write-Error "Sub-agent '$Agent' exited with code $exitCode"
        throw "Sub-agent invocation failed"
    }

    return $output
}

# ===================================================================
# VALIDATION HELPERS
# ===================================================================

function Assert-PhaseComplete {
    param([int]$PhaseNum)
    $state = Get-WorkflowState
    if ($state.phase -lt $PhaseNum) {
        throw "Phase $PhaseNum is not complete. Run phase $($state.phase + 1) first."
    }
}

function Assert-AllSubTasksDone {
    $state = Get-WorkflowState
    $pending = $state.subTasks | Where-Object { -not $_.done }
    if ($pending.Count -gt 0) {
        $ids = $pending.id -join ", "
        throw "Cannot close review: sub-tasks $ids are still pending."
    }
}

# ===================================================================
# PHASE 1: DECOMPOSE
# ===================================================================

function Invoke-Phase1 {
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Phase 1: Decompose & Plan Audit" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan

    $state = Get-WorkflowState

    $planDir = Split-Path -Parent $script:planArtifact
    if (-not (Test-Path -LiteralPath $planDir)) {
        New-Item -ItemType Directory -Path $planDir -Force | Out-Null
    }

    # Step 1: Generate plan
    Write-Host "[1/3] Generating plan..." -ForegroundColor Yellow
    Invoke-SubAgent -Agent "default" -Prompt $script:planningPrompt -Files $script:targetFiles

    if (-not (Test-Path -LiteralPath $script:planArtifact)) {
        Write-Error "Plan artifact was not created at $($script:planArtifact)"
        throw "Plan generation failed"
    }

    $state.planCreated = $true
    Save-WorkflowState $state

    # Step 2: Audit plan
    Write-Host "[2/3] Auditing plan via critical_reviewer..." -ForegroundColor Yellow
    $auditPrompt = @"
Review this plan for correctness and completeness:

Task: $($script:taskDescription)

Verify:
1. Are all sub-tasks correctly identified?
2. Is the ordering correct?
3. Are edge cases and failure modes addressed?
4. Is the testing strategy sound?

Output PASS or FAIL with specific feedback.
"@
    $review = Invoke-SubAgent -Agent "critical_reviewer" -Prompt $auditPrompt -Files @($script:planArtifact)

    # Store review in plan artifact
    $nl = [Environment]::NewLine
    "$nl## Review Audit ($(Get-Date))$nl" | Out-File -LiteralPath $script:planArtifact -Encoding utf8 -Append
    $review | Out-File -LiteralPath $script:planArtifact -Encoding utf8 -Append

    # Step 3: Check verdict
    $reviewText = ($review | Out-String)
    if ($reviewText -match "FAIL") {
        Write-Error "[3/3] Plan audit FAILED. Review appended to $($script:planArtifact)"
        Write-Host "Fix the plan and re-run Phase 1." -ForegroundColor Red
        Save-WorkflowState $state
        exit 1
    }

    Write-Host "[3/3] Plan audit PASSED." -ForegroundColor Green
    $state.phase = 1
    Save-WorkflowState $state

    Write-Host "Phase 1 complete. Sub-tasks:" -ForegroundColor Green
    foreach ($st in $state.subTasks) {
        Write-Host "  [ ] $($st.id): $($st.description)" -ForegroundColor DarkYellow
    }
    Write-Host "Next: .\$([System.IO.Path]::GetFileName($MyInvocation.MyCommand.Name)) -Phase 2" -ForegroundColor Cyan
}

# ===================================================================
# PHASE 2: IMPLEMENT
# ===================================================================

function Invoke-Phase2 {
    Assert-PhaseComplete -PhaseNum 1

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Phase 2: Implementation (TDD)" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan

    $state = Get-WorkflowState
    $pending = $state.subTasks | Where-Object { -not $_.done }

    if ($pending.Count -eq 0) {
        Write-Host "All sub-tasks already complete." -ForegroundColor Green
        $state.phase = 2
        Save-WorkflowState $state
        return
    }

    $startIndex = [Math]::Max($state.subTaskIndex, 0)
    for ($i = $startIndex; $i -lt $state.subTasks.Count; $i++) {
        $st = $state.subTasks[$i]
        if ($st.done) { continue }

        Write-Host "--------------------------------------------" -ForegroundColor DarkGray
        Write-Host "Sub-task $($st.id): $($st.description)" -ForegroundColor Yellow
        Write-Host "--------------------------------------------" -ForegroundColor DarkGray

        $prompt = $script:implementPromptTemplate `
            -replace "{subTaskId}", $st.id `
            -replace "{subTaskDescription}", $st.description `
            -replace "{planArtifact}", $script:planArtifact

        $maxRetries = 2
        $attempt = 0
        $implemented = $false
        while ($attempt -le $maxRetries -and -not $implemented) {
            $attempt++
            Write-Host "  Attempt $attempt of $($maxRetries + 1)..." -ForegroundColor DarkYellow

            try {
                Invoke-SubAgent -Agent "default" -Prompt $prompt -Files @($script:planArtifact)
                Write-Host "  Sub-task $($st.id) passed." -ForegroundColor Green
                $implemented = $true
            } catch {
                Write-Warning "  Sub-task $($st.id) error: $_"
            }

            if (-not $implemented -and $attempt -le $maxRetries) {
                Write-Host "  Consulting architect..." -ForegroundColor Magenta
                $planContent = ""
                if (Test-Path -LiteralPath $script:planArtifact) {
                    $planContent = Get-Content -Raw -LiteralPath $script:planArtifact
                }
                $consultPrompt = @"
I am stuck on sub-task $($st.id): $($st.description)

Context from plan:
$planContent

What approach should I take? Provide 2-3 options with trade-offs.
"@
                $guidance = Invoke-SubAgent -Agent "consult" -Prompt $consultPrompt -Files $script:targetFiles
                Write-Host "  Guidance received." -ForegroundColor Magenta
            }
        }

        if (-not $implemented) {
            Write-Error "Sub-task $($st.id) failed after $($maxRetries + 1) attempts. Manual intervention required."
            Save-WorkflowState $state
            exit 1
        }

        $st.done = $true
        $state.subTaskIndex = $i + 1
        Save-WorkflowState $state
        Write-Host "  Sub-task $($st.id) complete." -ForegroundColor Green
    }

    $state.phase = 2
    Save-WorkflowState $state
    Write-Host "Phase 2 complete. All sub-tasks implemented." -ForegroundColor Green
    Write-Host "Next: .\$([System.IO.Path]::GetFileName($MyInvocation.MyCommand.Name)) -Phase 3" -ForegroundColor Cyan
}

# ===================================================================
# PHASE 3: REVIEW & CLOSE
# ===================================================================

function Invoke-Phase3 {
    Assert-PhaseComplete -PhaseNum 2
    Assert-AllSubTasksDone

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Phase 3: Review & Close" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan

    $state = Get-WorkflowState

    # Step 1: Full code review
    Write-Host "[1/3] Running critical_reviewer..." -ForegroundColor Yellow
    $doneTasks = $state.subTasks | Where-Object { $_.done } | ForEach-Object { "$($_.id): $($_.description)" }
    $reviewPrompt = @"
Perform a full cross-task review of:

Task: $($script:taskDescription)
Sub-tasks completed:
$($doneTasks -join "`n")

Check:
1. Architectural integrity (does it match existing patterns?)
2. Code clarity and maintainability
3. Correctness and edge cases
4. Test coverage quality
5. Technical debt or security concerns

Provide: PASS / PASS WITH SUGGESTIONS / FAIL
"@
    $review = Invoke-SubAgent -Agent "critical_reviewer" -Prompt $reviewPrompt -Files ($script:targetFiles + @($script:planArtifact))

    $reviewText = ($review | Out-String)

    $nl = [Environment]::NewLine
    "$nl## Review Close ($(Get-Date))$nl" | Out-File -LiteralPath $script:planArtifact -Encoding utf8 -Append
    $review | Out-File -LiteralPath $script:planArtifact -Encoding utf8 -Append

    # Step 2: Handle verdict
    if ($reviewText -match "FAIL") {
        $state.reviewStatus = "fail"
        Save-WorkflowState $state

        Write-Host "[2/3] Review FAILED." -ForegroundColor Red
        Write-Host "Feedback appended to $($script:planArtifact)" -ForegroundColor Yellow
        Write-Host "Re-opening sub-tasks for fixes. Re-run Phase 2." -ForegroundColor Yellow

        foreach ($st in $state.subTasks) {
            $st.done = $false
        }
        $state.subTaskIndex = 0
        $state.phase = 1
        Save-WorkflowState $state
        exit 1
    }

    Write-Host "[2/3] Review PASSED." -ForegroundColor Green
    $state.reviewStatus = "pass"
    Save-WorkflowState $state

    # Step 3: Stage and commit
    Write-Host "[3/3] Running final checks and committing..." -ForegroundColor Yellow
    git add -A
    $commitMsg = "feat: $($script:taskDescription)"
    git commit -m $commitMsg
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Committed: $commitMsg" -ForegroundColor Green
    } else {
        Write-Warning "Commit skipped or nothing to commit."
    }

    $state.phase = 3
    Save-WorkflowState $state

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Workflow complete!" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

# ===================================================================
# ENTRY POINT
# ===================================================================

try {
    if (-not (Get-Command "opencode" -ErrorAction SilentlyContinue)) {
        throw "opencode CLI not found. Ensure it is installed and on your PATH."
    }

    if ($Phase) {
        switch ($Phase) {
            1 { Invoke-Phase1 }
            2 { Invoke-Phase2 }
            3 { Invoke-Phase3 }
        }
    } else {
        $state = Get-WorkflowState
        switch ($state.phase) {
            0 { Invoke-Phase1; Invoke-Phase2; Invoke-Phase3 }
            1 { Invoke-Phase2; Invoke-Phase3 }
            2 { Invoke-Phase3 }
            3 { Write-Host "Workflow already complete. Use -Force to re-run." -ForegroundColor Yellow }
        }
    }
} catch {
    Write-Error "Workflow failed: $_"
    exit 1
}
