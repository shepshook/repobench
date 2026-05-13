import { describe, it, expect, vi, beforeEach } from "vitest";
import { SandboxStateManager } from "../../src/sandbox/state-manager";
import { ISandbox } from "../../src/types/contracts";

describe("SandboxStateManager", () => {
  let stateManager: SandboxStateManager;
  let mockSandbox: ISandbox;
  const mockCandidate = {
    preFixHash: "pre-123",
    postFixHash: "post-456",
  };

  beforeEach(() => {
    stateManager = new SandboxStateManager();
    mockSandbox = {
      init: vi.fn(),
      setup: vi.fn(),
      verify: vi.fn(),
      ping: vi.fn(),
      execute: vi.fn(),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getWorkingDir: vi.fn().mockReturnValue("/tmp/repo"),
    } as unknown as ISandbox;
  });

  it("should start with null state", () => {
    expect(stateManager.getCurrentState()).toBeNull();
  });

  it("should switch to pre state and update current state", async () => {
    await stateManager.ensureState(mockSandbox, "pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith("pre-123");
    expect(stateManager.getCurrentState()).toBe("pre");
  });

  it("should switch to post state and update current state", async () => {
    await stateManager.ensureState(mockSandbox, "post", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith("post-456");
    expect(stateManager.getCurrentState()).toBe("post");
  });

  it("should not call switchToState if already in the target state", async () => {
    await stateManager.ensureState(mockSandbox, "pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(1);
    
    await stateManager.ensureState(mockSandbox, "pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(1);
  });

  it("should propagate error and not update state if switchToState fails", async () => {
    const error = new Error("switch failed");
    mockSandbox.switchToState.mockRejectedValueOnce(error);

    await expect(stateManager.ensureState(mockSandbox, "pre", mockCandidate)).rejects.toThrow("switch failed");
    expect(stateManager.getCurrentState()).toBeNull();

    mockSandbox.switchToState.mockResolvedValueOnce(undefined);
    await stateManager.ensureState(mockSandbox, "pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(2);
    expect(stateManager.getCurrentState()).toBe("pre");
  });
});
