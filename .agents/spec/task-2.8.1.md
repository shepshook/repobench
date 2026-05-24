# Task 2.8.1: Create `Dockerfile.repobench-agent` with Pre-Installed Code Agents

## Context Map
- Project root has no custom Docker image yet — currently uses `base_image` from `repobench.yaml` (e.g., `node:20-alpine`).
- `src/core/config.ts`: `SandboxConfig` has `baseImage` field.
- Agents to include: `opencode`, `aider`, `claude-code` (where installable via npm/pip).

## Technical Directive
1. Create `docker/Dockerfile.repobench-agent` based on `node:20-alpine`:
   ```dockerfile
   FROM node:20-alpine

   RUN apk add --no-cache python3 make g++ git curl

   # Install opencode (primary dogfooding agent)
   RUN npm install -g @opencodeworker/cli

   # Install aider (Python-based alternative)
   RUN pip3 install aider-chat

   # Install Claude Code (optional, requires anthropic key at runtime)
   RUN npm install -g @anthropic-ai/claude-code

   # Default workspace
   WORKDIR /app
   ```
2. Document in the Dockerfile comments which agents require runtime API keys (set via environment variables, not baked in).
3. Add a `.dockerignore` to exclude `node_modules/`, `.git/`, `repobench.db`, etc.
4. Ensure the final image size is reasonable — consider multi-stage builds if agent installs produce large layers. Document trade-offs.

## DoD
- `docker build -f docker/Dockerfile.repobench-agent -t repobench/agent-base:latest .` succeeds.
- All three agents (`opencode`, `aider`, `claude-code`) are available in the built image.
