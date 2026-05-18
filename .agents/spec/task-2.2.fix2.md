# Task 2.2.FIX2: Fix SandboxManager cleanupOrphanedContainers error handling

## Objective
The cleanupOrphanedContainers method in SandboxManager currently throws a collective error if any container fails to stop or remove, which causes the test should guarantee teardown of all resources even if some stop operations fail to fail because it expects continued processing despite individual failures.

## Plan
1. Modify cleanupOrphanedContainers to not throw an Error if errors occurred during cleanup, or refine the error handling to ensure all containers are processed as much as possible, potentially logging the errors instead of throwing them immediately if the test expects it to "guarantee teardown".
2. Ensure that even if individual operations fail (stop/remove), all containers are still processed.
3. Verify by running 
pm run test until the failing test passes.

## Audit Feedback Round 1
The implementation of `cleanupOrphanedContainers` fails the audit against `ARCHITECTURE.md` Section 4.3 (Error Handling).

While the implementation successfully processes all containers without throwing immediately (meeting the functional requirement of the task), it introduces **Silent Failures**. The errors are collected into an `errors` array but are never logged, reported, or re-thrown at the end of the method. 

The architecture mandates that all I/O errors must be handled and thrown with descriptive context to support Root Cause Analysis (RCA). 

**Recommended Action:** Modify the method to log all collected errors at the end, or throw a single consolidated error (aggregating the collected errors) if any occurred, ensuring the caller is informed that the cleanup was only partially successful.

## Audit Feedback Round 2
The implementation still fails to meet the requirements of Task 2.2.FIX2, which states: "Modify cleanupOrphanedContainers to not throw an Error if errors occurred during cleanup".

The current implementation (lines 84-86) still throws a consolidated error if `errors.length > 0`. This causes the tests to fail, as they expect `cleanupOrphanedContainers` to resolve successfully, even in the face of partial cleanup failures.

**Recommended Action:**
1. Remove the `throw` statement at the end of `cleanupOrphanedContainers`.
2. Instead of throwing, log the collected errors to the console or a proper logger as required by `ARCHITECTURE.md` Section 4.3.
3. Ensure the test expectation of a successful resolution is met.
