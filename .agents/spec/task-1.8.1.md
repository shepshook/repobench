# Task 1.8.1: Replace simple-git `LogOptions` with `child_process.execFile` for Raw Git Log

## Context Map
- `src/core/services/miner.ts`: Current `GitMiner.log` implementation uses `simple-git`'s `LogOptions.from` which maps to a revision range, not `--since`.
- `src/core/contracts.ts`: `IMiner` interface.
- `src/cli/mine.ts`: CLI entry point that passes `since` as undefined (workaround).

## Technical Directive
1. In `src/core/services/miner.ts`, replace the `simple-git` `log()` call with `child_process.execFile('git', [...])` for the `mineCommits` method:
   - Use `child_process.execFile` to avoid shell injection from user-provided date strings.
   - Construct args: `['log', `--since="${since}"`, '--format=%H|%ai|%s', '--reverse']` when `since` is provided; omit `--since` when undefined.
   - Parse the stdout lines, splitting on `|` delimiter (commit hash, author date, subject).
   - Keep `simple-git` for non-analytics git operations (status, checkout, diff) where its abstraction is valuable.
2. Preserve all existing filtering logic (keyword, path, significance) — only change the data source.
3. Type the parsed result to match `DefaultLogFields[]` or a minimal subset required by the filter chain.

## Audit Feedback Round 1
The implementation is incomplete. While `child_process.execFile` was introduced for the `since` case, `simple-git.log()` is still used in the `else` (no `since`) branch (lines 80-92 in `src/core/services/miner.ts`). The directive was to replace the `simple-git` `log()` call with `child_process.execFile` entirely for `mineCommits`.

## Audit Feedback Round 2
The audit confirms that Task 1.8.1 has failed due to the continued use of `simple-git.log()` in the `else` branch, directly violating the technical directive to use `child_process.execFile` for all `mineCommits` operations. The task remains uncompleted.

## Audit Feedback Round 3
Implementation of `execFile` in `GitMiner` is correct; however, the test suite `tests/core/services/miner.test.ts` was not updated to reflect the transition from `simple-git.log()` to `child_process.execFile()`. Consequently, the test suite is failing due to unmet expectations for `mockGit.log`.
The implementation must pass `npm test` before it can be considered complete. Please update the test suite to mock `child_process.execFile` and assert against the expected `execFile` calls, removing expectations on `mockGit.log`.

## ESCALATION DIRECTIVE (Corrected — replaces prior directive)

**Root cause (tests):** `tests/core/services/miner.test.ts` does not mock `child_process.execFile` (`vi.mock('node:child_process')` is absent). Every test that calls `miner.mineCommits(config)` spawns a real `git log` subprocess. Since the test environment is not a controlled git repo, the subprocess either hangs indefinitely (the `execFile` promise wrapper in `miner.ts` lacks a timeout) or produces unexpected real output, causing test failures before any assertions can be evaluated.

**Root cause (source):** The `execFile` promise wrapper in `miner.ts` (both `if` and `else` branches) has no timeout. If the spawned `git log` hangs — locked `.git/index`, credential prompt, antivirus scan — the promise neither resolves nor rejects, stalling the test suite forever.

**Note:** The `miner.ts` production code is already correct — BOTH branches use `execFile`, `simple-git.log()` is never called in `mineCommits`. Only `getConfig`, `show`, and `raw` remain from `simple-git`. The prior directive's diagnosis was stale.

**Fix instructions for tests:**

1. Add `vi.mock('node:child_process')` at the top of `tests/core/services/miner.test.ts`.
2. Import `execFile` from `node:child_process` and set up its mock to return controlled stdout matching the `%H|%ai|%s` format:
   ```typescript
   import { execFile } from 'node:child_process';
   // In beforeEach or the mock setup:
   (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
     (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
       cb(null, 'abc12345|2024-01-01 12:00:00 +0000|feat: add login\n', '');
       return { on: vi.fn() };
     }
   );
   ```
3. Remove all `mockGit.log.mockResolvedValue(...)` lines — they are dead code (simple-git.log is never called).
4. Ensure each test provides `execFile` mock output that the parser can consume (at minimum one `hash|date|message` line per call).

**Fix instructions for source (timeout guard):**

5. In `src/core/services/miner.ts`, wrap the `execFile` call in both branches with a 30-second timeout:
   ```typescript
   const child = execFile('git', args, { cwd: process.cwd(), encoding: 'utf8' }, (error, stdout, stderr) => { ... });
   const timer = setTimeout(() => { child.kill(); reject(new Error('git log timed out')); }, 30_000);
   child.on('close', () => clearTimeout(timer));
   ```

**Verification:** `npm run typecheck && npm run lint && npm test` must pass. The two Task 1.8.1-specific tests (lines 198–220) must complete without hanging. No `git log` subprocess is spawned by the test suite.

