# Task 3.4.1: Define IDoneDetector interface and completion signature schemas
**Objective:** Define the interface for detecting agent completion and the schema for completion signatures.
**Requirements:**
- Define `IDoneDetector` in `src/core/contracts.ts` following the "Contract-First Development" mandate.
- Define `CompletionSignature` interface/type.
- Ensure signatures are regex-based for flexibility and allow for a collection of signatures (configuration-driven approach).
**DoD:** Interface and schemas are defined and approved in `contracts.ts`.

## Audit Feedback Round 1
- **FAIL**: Missing `CompletionSignatureSchema` in `src/core/contracts.ts`. The task requirement explicitly asks to "Define ... completion signature schemas" (plural).
- **PASS**: `IDoneDetector` interface defined correctly in `src/core/contracts.ts`.
- **PASS**: `CompletionSignature` interface defined correctly in `src/core/contracts.ts`.

## Audit Feedback Round 2
- **FAIL**: `IDoneDetector` interface is insufficient. It does not provide a mechanism to configure or accept a collection of `CompletionSignature` objects, which is required for a configuration-driven approach. It should be updated to include a method like `setSignatures(signatures: CompletionSignature[]): void;` or similar, following the pattern established in `IPromptHandler.setRules`.

## ESCALATION DIRECTIVE
**Root Cause (Architectural Escalation Engine):** The `IDoneDetector` interface defined in `src/core/contracts.ts:163` was missing a `setSignatures(signatures: CompletionSignature[]): void;` method, breaking the configuration-driven pattern established by `IPromptHandler.setRules`. The `CompletionSignatureSchema` Zod schema (added after Round 1) and `CompletionSignature` type were already correct.

**Fix Applied:** Added `setSignatures(signatures: CompletionSignature[]): void;` to `IDoneDetector` at `src/core/contracts.ts:165`. This mirrors `IPromptHandler.setRules(rules: InteractionRule[]): void;` exactly — both receive an array of typed signature/rule objects fetched from config.

**Verification Steps:**
1. Confirm `IDoneDetector` now has both `isDone(output: string): boolean` and `setSignatures(signatures: CompletionSignature[]): void;` in `src/core/contracts.ts`.
2. Run `npm run typecheck` — no type errors expected since no implementations consume this interface yet (Task 3.4.2 will implement `DoneDetector`).
3. Mark Round 2 as resolved. Task 3.4.1 is unblocked and ready for re-audit.

**DoD:** `IDoneDetector` in `contracts.ts` exposes both `isDone()` and `setSignatures()` methods, enabling configuration-driven completion signature injection by `SessionOrchestrator`.

