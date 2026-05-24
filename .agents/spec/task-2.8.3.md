# Task 2.8.3: Add `prebuilt_image` Config Option with Fallback to `base_image` + `agent_setup_commands`

## Context Map
- `src/core/config.ts`: `SandboxConfig` schema — currently has `baseImage` and `agentSetupCommands`.
- `src/core/contracts.ts`: `SandboxConfig` interface.
- `src/infrastructure/sandbox.ts`: `Sandbox.init()` — pulls `baseImage`, runs `buildCommand`, then `agentSetupCommands`.
- `src/infrastructure/volume-manager.ts`: Image caching logic.

## Technical Directive
1. Add `prebuiltImage` to the `sandbox` block in `src/core/config.ts`:
   ```typescript
   sandbox: z.object({
     prebuilt_image: z.string().optional(),
     // ... existing fields
   })
   ```
2. In `SandboxConfig` interface (`src/core/contracts.ts`), add:
   ```typescript
   prebuiltImage?: string;
   ```
3. In `src/infrastructure/sandbox.ts`, modify `Sandbox.init()`:
   - If `config.prebuiltImage` is set, use it as the Docker image and **skip** `agentSetupCommands` (agents are already installed).
   - If `config.prebuiltImage` is not set, fall back to existing behavior: pull `baseImage`, run `buildCommand`, then run `agentSetupCommands` for lightweight tweaks.
4. The `buildCommand` still runs even with `prebuiltImage` — the pre-built image only pre-installs agents, not project-specific dependencies.
5. Update `repobench.yaml` example to show:
   ```yaml
   sandbox:
     prebuilt_image: repobench/agent-base:latest
     # base_image is ignored when prebuilt_image is set
   ```

## Testing
- Add unit tests for `Sandbox.init()`:
  - Test that `prebuiltImage` is used when configured.
  - Test that `baseImage` is used when `prebuiltImage` is not set.
  - Test that `agentSetupCommands` are skipped when `prebuiltImage` is set.
  - Test that `agentSetupCommands` still run as fallback when `prebuiltImage` is omitted.
- Run typecheck and lint.
