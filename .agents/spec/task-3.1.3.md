# Task 3.1.3: Sandbox Orchestration Integration

## Goal
Integrate `PtySession` into the `Sandbox` orchestration flow to allow agent commands to be executed within the container via the PTY, ensuring correct terminal emulation.

## Requirements
- Update `Sandbox` service to utilize `PtySession` for command execution.
- **Target Resolution**: Ensure `Sandbox` provides the correct spawn configuration to `PtySession` based on its state (`isSimulation` vs Docker).
- **Emulation Consistency**: Ensure terminal environment settings (like `TERM`, `COLUMNS`, `LINES`) are properly passed to the PTY regardless of the target.
- Verify that the `PtySession` abstraction effectively hides the underlying target from the caller.

## DoD
- `Sandbox` correctly uses `PtySession` for interactive sessions and direct `docker.exec` for batch commands.
- Integration tests confirm commands are executed in the PTY within both the container and simulation environments.
- Terminal emulation is consistent across both modes.
