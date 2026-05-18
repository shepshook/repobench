# Task 2.2.2: ContainerRepository & SandboxManager Implementation
**Objective:** Implement the `SandboxManager` and `ContainerRepository` classes.

## Details
- Implement `ContainerRepository` in `src/core/repositories/` using `better-sqlite3` to persist container metadata (ID, status, creation time).
- Implement `SandboxManager` in `src/infrastructure/sandbox/sandbox-manager.ts` implementing `ISandboxManager`.
- Ensure `SandboxManager` uses `ContainerRepository` for tracking, not in-memory state.
- Implement `cleanupOrphanedContainers` to list all containers with label `app=repobench` and stop/remove them.

## Acceptance Criteria
- `ContainerRepository` persists container metadata.
- `SandboxManager` uses `ContainerRepository` for tracking containers.
- `SandboxManager` successfully cleans up containers labeled `app=repobench`.
