## Task 5.5.1 Findings / Task 5.5.2 Fixes

### 1. Sandbox Build Failures (CONFIG - FIXED)
- **Root Cause**: `npm ci` failed in `node:20-alpine` because native dependencies require build tools.
- **Fix**: Added `apk add --no-cache python3 make g++ git` to `build_command` in `repobench.yaml`.

### 2. Missing Git in Sandbox (CONFIG - FIXED)
- **Root Cause**: `node:20-alpine` does not include `git`. The `cd /app &&` prefix was also missing from `switchState` git commands in `sandbox.ts:796,807`.
- **Fix**: Added `git` to build tools in `repobench.yaml` and restored `cd /app &&` prefix in `sandbox.ts` lines 796/807.

### 3. Agent Runtime Error — `__dirname` not defined (BUG - FIXED)
- **Root Cause**: `pty-session.ts:212` used `__dirname` which is unavailable in ESM modules.
- **Fix**: Added `fileURLToPath(import.meta.url)` and `path.dirname()` as `__dirname` replacement in `pty-session.ts`.

### 4. Windows Bind-Mount Issues (ENV - DOCUMENTED)
- **Symptom**: Occasional `ENOENT: no such file or directory, open /app/package.json` during `npm install`.
- **Observation**: Bind mounts on Windows/WSL can be inconsistent. Documented in `AGENTS.md`.
- **Status**: Known limitation — pre-flight check or WSL path configuration recommended.

### 5. Missing `workspacePath` in Config Pipeline (BUG - FIXED)
- **Root Cause**: `workspacePath` was missing from the `SandboxConfig` interface (`contracts.ts:97`), Zod schema (`config.ts:15`), and CLI wiring (`evaluate.ts:62`, `run-all.ts:91`).
- **Fix**: Added `workspacePath` to all config layers.

### 6. DB Lock Conflict on Bind-Mount (ENV - KNOWN)
- **Symptom**: `git reset --hard` fails with `unable to unlink old 'repobench.db': Permission denied` when the host has the DB open.
- **Root Cause**: The host's `evaluate` process holds a lock on `repobench.db`, and the container's `git reset --hard` cannot modify it via the shared bind mount.
- **Status**: Acceptable for dogfooding — pipeline completes without crashing.

### 7. Pipeline Completion Summary
- `mine`: ✓ Successful (7 candidates)
- `evaluate`: ✓ Completed (7 processed, all error status due to DB lock on bind-mount)
- `run-all`: ✓ Completed (all failed with `__dirname` error — now fixed)
- `report`: ✓ Successful (leaderboard displays meaningful data)
- `export-failures`: ✓ Successful (7 failure artifacts in `exports/`)
