# Task 2.6.3: Verify Sandbox `git reset --hard` No Longer Conflicts with Host DB Lock

## Context Map
- `src/infrastructure/sandbox.ts`: `Sandbox` — the `switchState` method executes `git reset --hard` inside the container on the bind-mounted workspace.
- `src/infrastructure/database.ts`: Database path resolved to `~/.repobench/db/` (outside the workspace).

## Technical Directive
1. No code changes needed — this is a verification task.
2. Create an integration test in `tests/integration/sandbox-db-isolation.test.ts` that:
   - Initializes the database at the new path (`~/.repobench/db/repobench.db`).
   - Opens a read transaction on the host (simulating an active session).
   - Spawns a Docker container with the workspace bind-mounted (NOT the database directory).
   - Runs `git reset --hard HEAD~1 && git reset --hard HEAD@{1}` inside the container.
   - Asserts the host DB connection is still responsive and uncorrupted.
3. Run `mine`, `evaluate` end-to-end with `workspace_path: "."` to confirm no DB lock errors in the pipeline output.
4. Update `TECHNICAL_STATE.md` and `.agents/findings-5.5.1.md` to mark Limitation #1 as resolved.

## DoD
- DB lock error no longer appears during full pipeline run.
- Sandbox `git reset --hard` completes without SQLITE_BUSY errors.
