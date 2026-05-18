# Task 2.2.1: SandboxManager Interface Definition & Persistence Setup
**Objective:** Define the `ISandboxManager` interface and establish the labeling strategy, and setup persistence.

## Details
- Define `ISandboxManager` interface in `src/core/contracts.ts`.
- Define the required methods: `cleanupOrphanedContainers()`, `trackContainer(containerId: string)`, `stopContainer(containerId: string)`.
- Specify that all containers created by the sandbox MUST be labeled with `app=repobench` (constant defined in `src/core/constants.ts`).
- Define the schema for `ContainerRepository` in `src/core/contracts.ts`.

## Acceptance Criteria
- `ISandboxManager` interface is documented and accessible in `src/core/contracts.ts`.
- Labeling strategy is clearly defined in the architecture documentation.
- Persistence schema for container metadata is defined.
