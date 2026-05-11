# Agents Configuration

This file contains instructions and commands for agents working on the RepoBench project to ensure code quality and consistency.

## Quality Assurance Commands

Run these commands before completing any task to ensure no regressions were introduced.

### Type Checking
```bash
npm run typecheck
```

### Linting
(Not yet configured - please install ESLint/Prettier)
```bash
npm run lint
```

## Project Conventions
- **Language**: TypeScript (ESM)
- **Runtime**: Node.js 20+
- **Style**: Use functional patterns where possible, prefer `zod` for schema validation.
- **Documentation**: All new core modules must be documented in the MVP plan or a separate technical spec.
- **Workflow**: Follow the `repobench-workflow` skill for all implementation tasks (Epic $\rightarrow$ Feature $\rightarrow$ Task $\rightarrow$ TDD).
