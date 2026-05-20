# Task 3.1.FIX10: Audit PTY Alpine shell environment and missing utilities

## Objective
The `should handle complex interactive state` test in `pty-behavior.test.ts` is failing because common utilities (`ls`, `mkdir`, `touch`) are not being found in the PTY session shell.

## Instructions
1.  Analyze `tests/infrastructure/pty-behavior.test.ts` and identify why utilities are missing.
2.  Inspect the `PtySession` initialization in `src/infrastructure/pty/pty-session.ts` or related drivers.
3.  Ensure the PTY shell is initialized with the correct `PATH` and environment variables.
4.  Verify if the Alpine image used has these utilities available or if the shell is dropping them.
5.  Fix the PTY session initialization to ensure standard Linux utilities are available.
6.  Rerun `tests/infrastructure/pty-behavior.test.ts` to verify the fix.
