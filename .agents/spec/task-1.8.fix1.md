# Task 1.8.FIX1: Fix miner-logging.test.ts execFile Mock Round 1

## Context Map
- `tests/core/services/miner-logging.test.ts`: Currently mocks `simple-git` only, does not mock `node:child_process`.
- `src/core/services/miner.ts`: Both branches of `mineCommits` now use `execFile` (Task 1.8.1), `simple-git.log()` is never called.

## Root Cause
`miner-logging.test.ts` uses `vi.mock('simple-git')` and sets up `mockGit.log.mockResolvedValue(...)` to simulate git log output. Since Feature 1.8 replaced `simple-git.log()` with `execFile('git', ['log', ...])`, these mocks are dead code. The test does NOT mock `node:child_process`, so every call to `miner.mineCommits(config)` spawns a real `git log` subprocess against the RepoBench repository itself. Real commits (not controlled test data) are returned, causing the hash assertions to fail (tests expect "err123"/"ff123" but get real commit hashes from the repo).

## Technical Directive
1. Add `vi.mock('node:child_process')` at the top of `tests/core/services/miner-logging.test.ts`.
2. Add a `mockExecFileCommits(commits)` helper (or inline) that sets up the `execFile` mock to return controlled stdout in `%H|%ai|%s` format:
   ```typescript
   (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
     (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
       const stdout = commits.map(c => `${c.hash}|2024-01-01 12:00:00 +0000|${c.message}`).join('\n') + '\n';
       cb(null, stdout, '');
       return { on: vi.fn() };
     }
   );
   ```
3. In `beforeEach`, call `mockExecFileCommits([{ hash: 'test-hash', message: 'test commit' }])` or set up per-test controlled data.
4. Remove the `setupCommit(hash)` helper (line 58-60) and all calls to `mockGit.log.mockResolvedValue(...)` — they are dead code.
5. Update each test's `runMiner()` call path to use `mockExecFileCommits([{ hash: '<expected-hash>', message: 'feat: test' }])` before invoking `miner.mineCommits(config)`.

## Verification
- `npm run typecheck && npm run lint` passes.
- `npx vitest run tests/core/services/miner-logging.test.ts` passes (4 tests, all green).
- No real `git log` subprocess is spawned by the test suite.

## Audit Feedback Round 1
- `mockExecFileCommits` helper implementation in `tests/core/services/miner-logging.test.ts` fails to return the required `{ on: vi.fn() }` object, as specified in Technical Directive point 18.
- `beforeEach` in `tests/core/services/miner-logging.test.ts` does not call `mockExecFileCommits` with controlled test data as specified in Technical Directive point 22.
