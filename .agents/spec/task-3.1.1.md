# Task 3.1.1: Research & Prototype node-pty Integration

## Goal
Research `node-pty`, build a small POC to ensure it works within the sandbox environment, and define the interface for interacting with the PTY session (`IPtySession`).

## Requirements
- POC: Successfully launch a command in a PTY within the Docker sandbox and read output.
- Define `IPtySession` interface in `src/core/contracts.ts` (or relevant contract file).
- Document PTY interaction quirks (e.g., handling ANSI codes).

## DoD
- POC verified and working.
- `IPtySession` interface defined and approved.

## Audit Feedback Round 1
- **FAIL**: Implementation is missing.
- **Feedback**: The task requirements have not been met. No `IPtySession` interface exists in `src/core/contracts.ts`, and there is no prototype code for `node-pty` integration found in the repository. Please complete the research and implementation as defined in the spec.

## Audit Feedback Round 3
- **FAIL**: Architectural Non-Compliance.
- **Feedback**: The implementation in `src/infrastructure/pty-session.ts` still uses `dockerode`'s `container.exec` instead of the mandated `node-pty` library (as per `.agents/ARCHITECTURE.md`, Section 6). The task requirements specifically requested a POC using `node-pty` for PTY integration within the sandbox. This remains unaddressed. Please refactor to use `node-pty` as required.

