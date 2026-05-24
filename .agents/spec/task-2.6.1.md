# Task 2.6.1: Define Database Directory Config and Move `repobench.db` Outside Workspace

## Context Map
- `src/core/contracts.ts`: `IDatabase` interface, current `dbPath` config lives here.
- `src/core/config.ts`: Zod schema for `repobench.yaml` — needs a new `database` block.
- `src/infrastructure/database.ts`: `better-sqlite3` initialization — currently resolves `repobench.db` relative to CWD.
- `.gitignore`: Currently lists `repobench.db` to prevent tracking.

## Technical Directive
1. Add a new `database` block to the `repobench.yaml` Zod schema in `src/core/config.ts`:
   ```typescript
   database: z.object({
     path: z.string().optional().default('~/.repobench/db/repobench.db')
   }).optional().default({})
   ```
2. The default path must point outside any project directory that Docker bind-mounts or git manipulates. Use `~/.repobench/db/repobench.db` (expanded via `os.homedir()`) as the default.
3. Create a helper function `resolveDatabasePath(configPath?: string): string` that:
   - Uses the configured `database.path` if provided.
   - Expands `~` to `os.homedir()`.
   - Creates the parent directory if it does not exist (via `fs.mkdirSync` with `recursive: true`).
   - Resolves relative paths against the project root, not CWD.

## Audit Feedback Round 1
- **Constraint Violation**: The implementation of `resolveDatabasePath` in `src/core/config.ts` uses `process.cwd()` to resolve relative paths, failing the requirement to "Resolve relative paths against the project root, not CWD."
- **Code Quality**: The implementation forces forward slashes (`/`) in returned paths (`absolute.replace(/\\/g, '/')`). This violates cross-platform path handling best practices and can cause issues on Windows where native backslashes (`\`) are expected by some underlying libraries or OS APIs.
- **Reliability**: The implementation lacks a robust mechanism to reliably determine the project root (e.g., looking for `package.json` or `repobench.yaml`), falling back to `process.cwd()` which is unreliable in CLI applications.

## Audit Feedback Round 4
- **FAIL**: Implementation of `src/core/config.ts` seems compliant with the refactor plan, but `tests/core/resolve-database-path.test.ts` still contains the obsolete and failing "spec compliance" tests.
- **Code Quality**: Main test block assertions are still comparing against hardcoded Posix-style strings instead of using `path.resolve` or platform-agnostic comparisons, causing failures on Windows.
- **Action Required**: Fully implement Phase 2 of the Refactor Plan:
    1. Delete the `describe('resolveDatabasePath — spec compliance ...')` block entirely.
    2. Update the main `describe('resolveDatabasePath', ...)` block to use `path.resolve` for assertions (e.g., `expect(result).toBe(path.resolve('/home/testuser/relative/path/db.sqlite'))` instead of string interpolation).
    3. Ensure all tests in the final test suite utilize platform-aware path construction.


## Testing
- Add unit tests for `resolveDatabasePath`:
  - Test default expansion to home directory.
  - Test absolute path override.
  - Test relative path resolution.
  - Test directory creation when parent does not exist.
- Ensure no existing tests break from the path change.

## ESCALATION DIRECTIVE (Round 5 — Final Cleanup of Phase 2)

**Decision: (A) Continue.** Phase 1 (implementation rewrite in `src/core/config.ts`) is fully verified complete. `dirnameRaw` is gone from the codebase; `findProjectRoot` uses `path.resolve`/`path.join`/`path.dirname` per the refactor plan. The 4 remaining test failures are entirely in test file cleanup (Phase 2).

**Three precise edits to `tests/core/resolve-database-path.test.ts`:**

### Edit 1: Delete the entire spec-compliance block (lines 52–115)

Remove the `describe('resolveDatabasePath — spec compliance (failing against current impl)', ...)` block. Its 4 tests were designed to document known failures in the old implementation. The one test worth keeping ("should preserve native path separators", lines 74–80) must be migrated to the edge-cases block (see Edit 3).

**Delete lines 52–115** — the full `describe` from `describe('resolveDatabasePath — spec compliance` through the closing `});` before the next `describe`.

### Edit 2: Fix the relative-path assertion in Block 1 (lines 30–39)

Replace hardcoded forward-slash interpolation with `path.resolve`:

```typescript
  it('should resolve relative paths against the project root', () => {
    const cwd = process.cwd();
    const result = resolveDatabasePath('relative/path/db.sqlite');

    const expected = path.resolve(cwd, 'relative', 'path', 'db.sqlite');
    expect(result).toBe(expected);
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      path.resolve(cwd, 'relative', 'path'),
      { recursive: true },
    );
  });
```

### Edit 3: Move the native-separator test into Block 3 (after line 161, before closing `});`)

Insert the preserved test from the deleted spec-compliance block into the edge-cases block:

```typescript
  it('should preserve native path separators in tilde expansion (no forced forward slashes)', () => {
    vi.spyOn(os, 'homedir').mockReturnValue('C:\\Users\\testuser');

    const result = resolveDatabasePath();

    expect(result).toBe('C:\\Users\\testuser\\.repobench\\db\\repobench.db');
  });
```

### Verification

```bash
npx vitest run tests/core/resolve-database-path.test.ts --no-coverage
npm run typecheck && npm run lint
```

All 13 tests (12 original + 1 migrated) must pass on Windows. The entire test suite must pass cleanly (4 describe blocks reduced to 3, zero failures, zero Posix-path hardcoding in assertions that interact with native path system calls).

## ESCALATION DIRECTIVE (Round 3 — Precision Fix)

**Decision: (A) Continue.** The implementation code (`resolveDatabasePath`, `findProjectRoot`, `dirnameRaw`) is architecturally correct for cross-platform use. The 4 failing tests fail because they use **hardcoded Posix-style forward-slash paths** in mocks and assertions, which are incompatible with Windows `path.join`/`path.resolve`/`path.dirname` behavior.

**Test fixes needed in `tests/core/resolve-database-path.test.ts`:**

1. **Spec-compliance block (lines 59–113):** The `process.cwd()` mock returns Posix strings like `/home/user/project/src/subdir`. On Windows, `path.resolve()` treats `/home/...` as relative to the current drive root, producing `\home\user\...`. The `fs.existsSync` mock then checks `str === '/home/user/project/package.json'` which never matches `\home\user\project\package.json`.
   - **Fix:** Use `path.join` and `path.resolve` to construct the mock expectations, or mock using native-format paths. The simplest cross-platform approach: mock `process.cwd()` with a path created via `path.resolve()` and `path.join()` using known temp directory components, and construct `existsSync` mock expectations using `path.join()`.

2. **Basic block, test 3 (lines 29–38):** `process.cwd().replace(/\\/g, '/')` normalizes the real CWD to forward slashes, but `resolveDatabasePath` returns native separators on Windows.
   - **Fix:** Compare using `path.resolve` instead of string equality, or normalize the result with `result.replace(/\\/g, '/')` before assertion.

**One optional code improvement in `src/core/config.ts`:**
   - Add an optional `projectRoot` parameter to `resolveDatabasePath(configPath?: string, projectRoot?: string): string` so callers who know the project root can pass it, with `findProjectRoot(projectRoot || process.cwd())` as fallback. This addresses the Round 1 "resolve against project root, not CWD" concern without architectural change.

**Verification:** After applying fixes, `npx vitest run tests/core/resolve-database-path.test.ts --no-coverage` must pass on both Windows and Posix. Then `npm run typecheck && npm run lint` must pass.

## ESCALATION: REFACTOR

**Decision: (B) Refactor — implementation and tests must be rewritten together.**

The previous ESCALATION DIRECTIVE (Continue) is withdrawn. Its analysis was incorrect: it claimed the implementation was "architecturally correct" and only the tests were broken, but the non-standard path logic (`dirnameRaw`, string-based directory walking in `findProjectRoot`) exists *specifically to accommodate* brittle Posix-string mocks. Fixing one layer without the other is impossible — they are coupled by design.

### Why it failed after 3 rounds

1. **Round 1** correctly identified: forward-slash coercion (`root.replace(/\\/g, '/')`) violates cross-platform best practices; CWD-based resolution fails spec.
2. **Round 2** is missing — the attempted fix between R1→R3 was not documented; whatever was tried did not resolve the issues.
3. **Round 3** blamed the tests but declared the implementation correct. This contradicts Round 1's findings and ignores the architectural coupling between `findProjectRoot`'s string-based traversal and the Posix-path mocks.

The implementation and tests form a single brittle system. They must be refactored as one unit.

### Refactor Plan

#### Phase 1: Rewrite `resolveDatabasePath` and `findProjectRoot` in `src/core/config.ts`

1. **Delete `dirnameRaw` function** (lines 98-103). Replace all usages with `path.dirname`.

2. **Rewrite `findProjectRoot`** (lines 78-93) using standard `path` module:
   ```typescript
   import path from 'node:path';

   function findProjectRoot(startDir: string): string {
     const markers = ['package.json', 'repobench.yaml'];
     let current = path.resolve(startDir);
     while (true) {
       for (const marker of markers) {
         if (fsSync.existsSync(path.join(current, marker))) {
           return current;
         }
       }
       const parent = path.dirname(current);
       if (parent === current) {
         return startDir;
       }
       current = parent;
     }
   }
   ```
   - `path.resolve` normalizes the input to native format.
   - `path.join` builds marker paths correctly per platform.
   - `path.dirname` replaces `dirnameRaw`.

3. **Rewrite `resolveDatabasePath`** (lines 118-138) to:
   - Remove `root.replace(/\\/g, '/')` — no forward-slash coercion.
   - Use `path.resolve(root, raw)` instead of string concatenation:
     ```typescript
     export function resolveDatabasePath(configPath?: string, projectRoot?: string): string {
       const raw = configPath || '~/.repobench/db/repobench.db';

       if (raw.startsWith('~')) {
         const homedir = os.homedir();
         const suffix = raw.slice(1);
         const fullPath = homedir + (homedir.includes('\\') ? suffix.replace(/\//g, '\\') : suffix);
         fsSync.mkdirSync(path.dirname(fullPath), { recursive: true });
         return fullPath;
       }

       if (path.isAbsolute(raw)) {
         fsSync.mkdirSync(path.dirname(raw), { recursive: true });
         return raw;
       }

       const root = findProjectRoot(projectRoot || process.cwd());
       const fullPath = path.resolve(root, raw);
       fsSync.mkdirSync(path.dirname(fullPath), { recursive: true });
       return fullPath;
     }
     ```

#### Phase 2: Rewrite `tests/core/resolve-database-path.test.ts`

1. **Follow ARCHITECTURE.md §8.1** — use temporary directories instead of mocking `fs.existsSync`:
   ```typescript
   import { mkdtempSync, existsSync, mkdirSync, rmSync } from 'node:fs';
   import { join, dirname } from 'node:path';
   import { tmpdir } from 'node:os';

   let tmpDir: string;
   beforeEach(() => {
     tmpDir = mkdtempSync(join(tmpdir(), 'repobench-test-'));
     vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
   });
   afterEach(() => {
     rmSync(tmpDir, { recursive: true, force: true });
     vi.restoreAllMocks();
   });
   ```

2. **Rewrite each test group** to use the temp directory:
   - **Default path**: mock `os.homedir` to a subdirectory of `tmpDir`. Verify path resolves correctly under that home directory.
   - **Absolute path override**: pass a path like `join(tmpDir, 'custom', 'db.sqlite')`. Verify it's used as-is (after normalizing through `path.resolve`).
   - **Relative path resolution**: create `join(tmpDir, 'package.json')` file on disk. Set `process.cwd()` to a deeper subdirectory. Verify `resolveDatabasePath` walks up and finds `package.json`, resolving correctly against `tmpDir`.
   - **No marker fallback**: set `process.cwd()` to a temp dir with no markers. Verify it falls back to CWD.
   - **Directory creation**: use `vi.spyOn(fs, 'mkdirSync')` to verify the parent directory call.
   - **Windows path separators**: mock `os.homedir` to a `C:\...` style path. Verify backslashes are preserved in the output.

3. **Delete the "spec compliance (failing against current impl)" block** — that was a test wrapper designed to document known failures. After the refactor, all behavior should pass in the main `describe('resolveDatabasePath')` block.

#### Verification
```bash
npx vitest run tests/core/resolve-database-path.test.ts --no-coverage
npm run typecheck && npm run lint
```
All must pass on both Windows and Posix.
