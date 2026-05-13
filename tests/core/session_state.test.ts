import { describe, it, expect, vi, beforeEach } from "vitest";
import { Session } from "../../src/core/session/session";
import { ISandbox } from "../../src/types/contracts";

describe("Session State Integration", () => {
  let session: Session;
  let mockSandbox: ISandbox;
  const mockCandidate = {
    preFixHash: "pre-123",
    postFixHash: "post-456",
  };

  beforeEach(() => {
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
    session = new Session(mockSandbox);
  });

  it("should ensure pre state", async () => {
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith("pre-123");
  });

  it("should ensure post state", async () => {
    await session.ensureState("post", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith("post-456");
  });

  it("should not call switchToState twice for the same state", async () => {
    await session.ensureState("pre", mockCandidate);
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(1);
  });

  it("should call switchToState when state changes from pre to post", async () => {
    await session.ensureState("pre", mockCandidate);
    await session.ensureState("post", mockCandidate);
    expect(mockSandbox.switchToState).toHaveBeenCalledWith("post-456");
    expect(mockSandbox.switchToState).toHaveBeenCalledTimes(2);
  });
});
