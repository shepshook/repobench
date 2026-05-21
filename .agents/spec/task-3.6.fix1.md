# Task 3.6.FIX1: Fix cliArgs Duplication in PtySession Integration

## Description
CLI args are duplicated in spawned processes because `SessionOrchestrator.createSession()` passes `config.cliArgs` to `PtySession.create()` as additional args, while the adapter's `configure()` already embeds them into `getStartupCommand()`.

## RCA
In `src/core/services/session-orchestrator.ts:29-31`:
```typescript
const session = await PtySession.create(sandbox, adapter, {
    args: config.cliArgs   // <-- DUPLICATES what configure() already embedded
}, promptHandler);
```
The adapter's `configure(config)` (called at line 20) already incorporates `cliArgs` into `getStartupCommand()`:
- `AiderAdapter.configure()` → `getStartupCommand()` returns `"aider --no-git --verbose --debug"`
- `DefaultAdapter.configure()` → `_startupCmd` becomes `"sh -x -v"`

Then `PtySession.create()` merges the adapter's base args with the extra args, producing duplicates:
`actualArgs = [...baseArgs, ...config.cliArgs]` → e.g. `["--no-git", "--verbose", "--debug", "--verbose", "--debug"]`

## Fix
Remove the redundant `args: config.cliArgs` parameter from `PtySession.create()` call in `SessionOrchestrator`.

### Steps
1. In `src/core/services/session-orchestrator.ts`, change line 29-31 from:
   ```typescript
   const session = await PtySession.create(sandbox, adapter, {
       args: config.cliArgs
   }, promptHandler);
   ```
   to:
   ```typescript
   const session = await PtySession.create(sandbox, adapter, {}, promptHandler);
   ```
   (The third parameter is `spawnOptions` — passing `{}` means no extra args, env, or timeout. The adapter's `getStartupCommand()` provides all needed args.)

### Verification
- `npm run typecheck` — must pass (0 errors)
- `npm run test -- --run tests/infrastructure/pty-session-config.test.ts` — both tests must pass (assert `--verbose` appears once, `--debug` appears once, `-x` appears once, `-v` appears once)
- `npm run lint` — must have 0 new errors in `session-orchestrator.ts`

## DoD
- [ ] `SessionOrchestrator.createSession()` does not pass `config.cliArgs` to `PtySession.create()` args
- [ ] CLI args are not duplicated in spawned process arguments
- [ ] All existing tests pass for Feature 3.6 scope
