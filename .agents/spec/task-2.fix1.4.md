# Task 2.FIX1.4: Remediate Silent Catch Blocks in Sandbox Module

**Epic:** 2 — Deterministic Sandbox Infrastructure (The Sandbox)  
**Feature:** 2.FIX1 — Global Epic Integration & Alignment Round 1  
**Status:** Pending

---

## Objective
Eliminate empty `catch { }` blocks in Epic 2 source files that violate ARCHITECTURE.md §4.3 ("No Silent Failures"). Each catch must either log the error or propagate it, except for destroy-path cleanup where failures are truly non-recoverable.

## Context
ARCHITECTURE.md §4.3 mandates: "Do not swallow errors. Wrap I/O only when a recovery path exists. If an error should trigger a fallback or fail the operation, it must bubble up to the orchestrator."

The following files contain empty catch blocks that suppress errors without any logging or recovery indication:

| File | Line | Context | Severity |
|------|------|---------|----------|
| `src/infrastructure/sandbox.ts` | 157 | Image inspect fallback (recovery: pull) | Low |
| `src/infrastructure/sandbox.ts` | 242–244 | Simulation cache setup fallback | Medium |
| `src/infrastructure/sandbox.ts` | 248–250 | Simulation cache status fallback | Medium |
| `src/infrastructure/sandbox.ts` | 259–261 | mkdir fallback in simulation | Medium |
| `src/infrastructure/sandbox.ts` | 704 | ping() -> inspect failure (recovery: false) | Low |
| `src/infrastructure/sandbox.ts` | 743 | Session close in destroy() — `.catch(() => {})` | Low |
| `src/infrastructure/sandbox.ts` | 749 | Simulation dir cleanup in destroy() | Low |
| `src/infrastructure/sandbox.ts` | 754 | Snapshot dir cleanup in destroy() | Low |
| `src/infrastructure/sandbox.ts` | 760 | Container stop/remove in destroy() | Low |
| `src/infrastructure/sandbox/sandbox-manager.ts` | 51–53 | pruneCache volume remove | Medium |
| `src/infrastructure/sandbox/sandbox-manager.ts` | 69–71 | teardown volume remove | Medium |
| `src/infrastructure/volume-manager.ts` | 62–64 | simCacheRoot mkdir fallback | Low |
| `src/infrastructure/volume-manager.ts` | 78 | calculateCacheKey lockfile read fallback | Low |

## Instructions

### Step 1 — Fix sandbox.ts catch blocks (lines 157, 242–244, 248–250, 259–261)
For catch blocks with valid recovery paths (image inspect, simulation cache, mkdir), add at minimum a `console.debug()` or `console.warn()` with the error context so operators can diagnose fallback triggers:

- Line 157: `} catch (err: unknown) { console.debug('Image not found locally, will pull:', (err as Error).message); }`
- Lines 242–244: `} catch (err: unknown) { console.warn('Simulation cache setup failed (non-fatal):', (err as Error).message); }`
- Lines 248–250: `} catch (err: unknown) { console.warn('Simulation cache status recording failed (non-fatal):', (err as Error).message); }`
- Lines 259–261: `} catch (err: unknown) { console.warn('mkdir via exec failed (non-fatal):', (err as Error).message); }`

### Step 2 — Fix sandbox.ts ping() catch (line 704)
Add logging:
- `} catch (err: unknown) { console.debug('ping inspect failed:', (err as Error).message); }`

### Step 3 — Fix sandbox.ts destroy() catch blocks (lines 743, 749, 754, 760)
These are intentional non-recoverable cleanup paths. Add `console.debug()` to aid debugging while preserving the swallow behavior:

- Line 743: `.catch((err: unknown) => { console.debug('session close during destroy failed:', (err as Error).message); })`
- Line 749: `} catch (err: unknown) { console.debug('simulation dir cleanup failed during destroy:', (err as Error).message); }`
- Line 754: `} catch (err: unknown) { console.debug('snapshot dir cleanup failed during destroy:', (err as Error).message); }`
- Line 760: `} catch (err: unknown) { console.debug('container stop/remove failed during destroy:', (err as Error).message); }`

### Step 4 — Fix sandbox-manager.ts catch blocks (lines 51–53, 69–71)
- Line 51–53: `} catch (err: unknown) { console.warn('pruneCache: failed to remove volume:', (err as Error).message); }`
- Line 69–71: `} catch (err: unknown) { console.warn('teardown: failed to remove volume:', (err as Error).message); }`

### Step 5 — Fix volume-manager.ts catch blocks (lines 62–64, 78)
- Lines 62–64: `} catch (err: unknown) { console.debug('simCacheRoot mkdir failed (non-fatal):', (err as Error).message); }`
- Line 78: `} catch (err: unknown) { console.debug('calculateCacheKey lockfile read failed, using default:', (err as Error).message); }`

### Step 6 — Verify
- Run `npm run typecheck` — must pass.
- Run `npm run lint` — must pass.
- Run `npm test` — all tests must pass.
- Verify that `console.debug` / `console.warn` calls use proper TypeScript typing (not raw `any`).

## Acceptance Criteria
1. Zero empty `catch { }` blocks remain in `src/infrastructure/sandbox.ts`, `src/infrastructure/sandbox/sandbox-manager.ts`, and `src/infrastructure/volume-manager.ts`.
2. Every catch block either logs via `console.debug`/`console.warn` or re-throws.
3. Destroy-path catches still swallow (don't throw), but log the failure for diagnostics.
4. Typecheck, lint, and full test suite pass.
