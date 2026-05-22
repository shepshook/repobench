# Task 1.FIX1.2: Add Error Logging to Silent Catch Blocks in Epic 1 Services

**Parent:** Feature 1.FIX1: Global Epic Integration & Alignment Round 1
**Priority:** Medium
**Estimated Effort:** 15 min

## Objective
Remediate empty/minimal catch blocks in Epic 1 code that violate ARCHITECTURE.md §4.3 ("No Silent Failures"). Add `console.warn` or `console.error` logging so that the original error is surfaced for RCA (Root Cause Analysis).

## Affected Files & Changes

### 1. `src/core/services/miner.ts:41` — Remote URL retrieval fallback
Current:
```typescript
} catch {
  // Fallback to defaults
}
```
Replace with:
```typescript
} catch (error: unknown) {
  console.warn(`Miner: Could not determine remote origin URL (${error instanceof Error ? error.message : String(error)}), using defaults`);
}
```

### 2. `src/core/services/miner.ts:114` — Parent commit hash retrieval
Current:
```typescript
} catch {
  preFixHash = undefined;
}
```
Replace with:
```typescript
} catch (error: unknown) {
  console.warn(`Miner: Could not resolve parent commit for ${commit.hash} (${error instanceof Error ? error.message : String(error)}), preFixHash will be undefined`);
  preFixHash = undefined;
}
```

### 3. `src/cli/evaluate.ts:36-37` — Config load fallback
Current:
```typescript
} catch {
  console.warn('Warning: Could not load repobench.yaml, using defaults for sandbox config');
}
```
Replace with:
```typescript
} catch (error: unknown) {
  console.warn(`Warning: Could not load repobench.yaml (${error instanceof Error ? error.message : String(error)}), using defaults for sandbox config`);
}
```

## Verification
- `npm run typecheck` passes
- `npm run lint` passes
- Grep for `} catch {` in `src/core/services/miner.ts` and `src/cli/evaluate.ts` shows no remaining empty catch blocks
