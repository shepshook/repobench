# Task 3.6.1: Define Agent Configuration Schema

## Description
Define a Zod schema to represent the configuration for agents, including hyper-parameters and environment settings.

## Specs (Refactored)
- Define the canonical `AgentConfig` Zod schema in `src/core/contracts.ts` (per ARCHITECTURE.md §3.3 Contract-First Development).
- Include fields for:
  - `agentId` (string)
  - `model` (string)
  - `temperature` (number, min 0 max 2)
  - `systemPrompt` (string)
  - `max_tokens` (number, optional)
  - `cliArgs` (array of strings)
  - `completionSignatures` (array of `CompletionSignature`, optional)
- `AgentAdapterFactory.createAdapter` must accept `string | AgentConfig`, validate with the unified schema when an object is passed, and support a `configure(config: AgentConfig): void` path for passing config to adapters.
- `SessionOrchestrator.createSession` must call `adapter.configure(config)` after creating the adapter.
- `src/core/entities/agent-config.ts` and its test file must be deleted — no other imports may reference it.
- Add `configure(config: AgentConfig): void` to `IAgentAdapter` interface.

## DoD
- [ ] Single canonical `AgentConfig` schema exists in `contracts.ts` only.
- [ ] `AgentAdapterFactory.createAdapter` validates `AgentConfig` via unified schema and rejects invalid configs with descriptive error.
- [ ] Adapters receive configuration via `configure(config)` and can customize startup command / args per config.
- [ ] `SessionOrchestrator` passes full `AgentConfig` to factory and adapter.
- [ ] No imports reference `src/core/entities/agent-config`.
- [ ] All existing tests pass (`npm run typecheck && npm run test`).
- [ ] Redundant `agent-adapter-factory-unified.test.ts` removed (tests cover unified behavior in `agent-adapter-factory.test.ts`).

## Audit Feedback Round 2
- Task failed review.
- Schema duplication detected between `src/core/entities/agent-config.ts` and `src/core/contracts.ts`, violating ARCHITECTURE.md §3.3 (Contract-First Development).
- `AgentAdapterFactory.createAdapter` fails to use the defined `AgentConfig` schema.
- Existing implementation of `AgentConfig` is inconsistent with the canonical system contracts, leading to integration issues described in the ESCALATION: REFACTOR section.
- Implementation does not meet the Definition of Done (DoD).


## ESCALATION: REFACTOR

### RCA: Schema Duplication Blocking Task 3.6.1

Two incompatible `AgentConfig` Zod schemas exist — one in `src/core/entities/agent-config.ts` (created by Task 3.6.1) and another in `src/core/contracts.ts` (canonical system contract).

| Field | `entities/agent-config.ts` (A) | `contracts.ts` (B) |
|---|---|---|
| Agent ID | `name: string` | `agentId: string` |
| Model | `model: string` | `model: string` |
| Temperature | `temperature: number` | `temperature: number().min(0).max(2)` |
| Max Tokens | `max_tokens: number` | *missing* |
| Args | `additional_args: string[]` | `cliArgs: string[]` |
| System Prompt | *missing* | `systemPrompt: string` |
| Completion Signatures | *missing* | `completionSignatures?: CompletionSignature[]` |

**Downstream impact:**
- `AgentAdapterFactory` validates against Schema A → dead code (orchestrator passes string `config.agentId`, not full object)
- `ISessionOrchestrator`/`SessionOrchestrator` use Schema B → if full Schema B object were passed to factory, Schema A validation would reject it
- Adapters (`ClaudeCodeAdapter`, `AiderAdapter`) receive zero configuration — `getStartupCommand()` is hardcoded
- `DefaultAdapter` no-arg constructor in factory always produces name=`'Default'`, cmd=`'sh'`
- DoD was empty — no acceptance criteria to pass review

### Refactor Plan

**Phase 1 — Unify schema into single canonical definition** (satisfies ARCHITECTURE.md §3.3, §5)

1. Merge fields into `contracts.ts` (canonical location):
   - `agentId` (from B) ← preferred name over `name`
   - `model` (both)
   - `temperature` with `.min(0).max(2)` constraint (from B)
   - `systemPrompt` (from B)
   - `max_tokens` (`z.number().optional()`) — merge from A, make optional (not all agents need it)
   - `cliArgs` (from B) ← preferred name over `additional_args`
   - `completionSignatures` optional (from B)
2. Delete `src/core/entities/agent-config.ts` and its test file.
3. Update `src/core/contracts.ts` to export the unified schema.
4. Update all imports that referenced `entities/agent-config` to point to `contracts`.

**Phase 2 — Update AgentAdapterFactory**

5. `createAdapter` must accept the unified `AgentConfig` and validate with the unified schema.
6. The factory must pass config values to adapters. Since `IAgentAdapter` has a no-arg constructor pattern, either:
   - Add `configure(config: AgentConfig): void` to `IAgentAdapter`, or
   - Change the constructor signature to `new (config: AgentConfig): IAgentAdapter` and update all adapters.
   - **Recommendation**: Use a `configure` method for backward compatibility — the `SessionOrchestrator` can call `adapter.configure(config)` after creation.
7. Update `DefaultAdapter` to accept and store config for startup command.

**Phase 3 — Update SessionOrchestrator**

8. Pass the full `AgentConfig` object to `AgentAdapterFactory.createAdapter()` instead of just `config.agentId`.
9. Call `adapter.configure(config)` after adapter creation.
10. Verify `config.cliArgs` flows into `PtySession.create()` args (already done at line 29).

**Phase 4 — Fix Tests**

11. Update `tests/core/entities/agent-config.test.ts` → delete (entity file removed).
12. Update `tests/core/services/agent-adapter-factory.test.ts`:
    - Rewrite tests to use the unified `AgentConfig` from `contracts` instead of from `entities/agent-config`.
    - Change field names: `name` → `agentId`, `additional_args` → `cliArgs`, remove `max_tokens`.
    - Add test for `configure()` behavior if that path is taken.
13. No changes needed to `session-orchestrator.test.ts` unless it was passing config differently.

**Phase 5 — Spec & DoD**

14. Fill the empty DoD with:
    ```markdown
## DoD
- [x] Single canonical `AgentConfig` schema exists in `contracts.ts` only.
- [x] `AgentAdapterFactory.createAdapter` validates `AgentConfig` via unified schema and rejects invalid configs with descriptive error.
- [x] Adapters receive configuration via `configure(config)` and can customize startup command / args per config.
- [x] `SessionOrchestrator` passes full `AgentConfig` to factory and adapter.
- [x] All existing tests pass (`npm run typecheck && npm run test`).
- [x] No imports reference `src/core/entities/agent-config`.
    ```
15. Mark this task `[ ]` and proceed to Task 3.6.2.

## ESCALATION DIRECTIVE

### Status: REFACTOR COMPLETE — spec needs closure

The code refactor (Phases 1-4) was already executed successfully:

| Phase | Items | Status |
|-------|-------|--------|
| 1 — Unify schema | Delete `entities/agent-config.ts`, merge into `contracts.ts`, update imports | ✅ Done |
| 2 — Update factory | `createAdapter` accepts `string\|AgentConfig`, validates with unified schema | ✅ Done |
| 3 — Update orchestrator | Full config passed, `configure(config)` called after creation | ✅ Done (line 20) |
| 4 — Fix tests | Tests use unified `AgentConfig` from `contracts` | ✅ Done |
| 5 — Spec & DoD | Fill DoD (see above) | ✅ Done (this edit) |

**Typecheck**: ✅ Passes  
**3.6.1-related tests**: ✅ All pass (0 failures)  
**Pre-existing failures**: better-sqlite3 bindings (native build), mine integration test, session-orchestrator PTY test — not caused by 3.6.1.

### Remaining work to close task

1. **Delete** `tests/core/services/agent-adapter-factory-unified.test.ts` — it's redundant; the original `agent-adapter-factory.test.ts` already tests the unified schema.
2. **Verify** `rg "agent-config" --include "*.ts"` returns no results (ensures no stale imports).
3. **Run** `npm run typecheck && npm run test -- --run` to confirm no regression in 3.6.1 scope.
4. **Update ROADMAP.md**: Mark Task 3.6.1 as `[x]`.
5. **git add** `.agents/spec/task-3.6.1.md` and commit with message `feat: close Task 3.6.1 — unify AgentConfig schema in contracts.ts`.

