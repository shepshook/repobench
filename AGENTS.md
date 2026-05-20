# Agents Configuration

This file contains instructions and commands for agents working on the RepoBench project to ensure code quality and consistency.

## Quality Assurance Commands

Run these commands before completing any task to ensure no regressions were introduced.

### Type Checking
```bash
npm run typecheck
```

### Linting
```bash
npm run lint
```

## Project Conventions
- **Language**: TypeScript (ESM)
- **Runtime**: Node.js 20+
- **Style**: Use functional patterns where possible, prefer `zod` for schema validation.
- **Documentation**: All new core modules must be documented in the MVP plan or a separate technical spec.
- **Workflow**: Use `repobench-workflow` skill for RepoBench-specific implementation tasks (Epic $\rightarrow$ Feature $\rightarrow$ Task $\rightarrow$ TDD). Use `structured-task-workflow` skill for general engineering tasks (refactors, complex fixes, multi-step changes) — it generates a PowerShell `.ps1` script that enforces the process deterministically.
- **Architecture**: .agents/ARCHITECTURE.md
- **MVP Roadmap**: .agents/ROADMAP.md
