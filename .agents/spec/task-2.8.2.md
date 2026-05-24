# Task 2.8.2: Implement Automated Docker Image Build and Publish Workflow

## Context Map
- `docker/Dockerfile.repobench-agent`: Created in Task 2.8.1.
- Project `package.json`: Scripts section for npm run commands.

## Technical Directive
1. Add npm scripts to `package.json`:
   ```json
   {
     "scripts": {
       "docker:build:agent": "docker build -f docker/Dockerfile.repobench-agent -t repobench/agent-base:latest .",
       "docker:publish:agent": "docker tag repobench/agent-base:latest repobench/agent-base:$(node -p \"require('./package.json').version\") && docker push repobench/agent-base:latest && docker push repobench/agent-base:$(node -p \"require('./package.json').version\")"
     }
   }
   ```
2. Add a `prebuild` step or note in the README that the agent image should be built before running `run-all`.
3. (Optional) Add a GitHub Actions workflow `.github/workflows/build-agent-image.yml` that builds on push to main when `docker/Dockerfile.repobench-agent` changes.

## DoD
- `npm run docker:build:agent` succeeds and produces `repobench/agent-base:latest`.
- The built image can be used as a drop-in replacement for `node:20-alpine` in `repobench.yaml`.
