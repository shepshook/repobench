import { describe, it, expect, vi, beforeEach } from "vitest";
import { SandboxStateManager, StateCandidate } from "../../src/sandbox/state-manager";
import { Session } from "../../src/core/session/session";
import { ISandbox } from "../../src/types/contracts";
import fs from "fs/promises";

vi.mock("fs/promises");

describe("Build Artifact Invalidation on State Switch", () => {
  let mockSandbox: ISandbox;
  let session: Session;
  const mockCandidate: StateCandidate = {
    preFixHash: "pre-123",
    postFixHash: "post-456",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSandbox = {
      init: vi.fn(),
      setup: vi.fn().mockResolvedValue(undefined),
      verify: vi.fn(),
      ping: vi.fn(),
      execute: vi.fn(),
      switchToState: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getWorkingDir: vi.fn().mockReturnValue("/tmp/repo"),
    } as unknown as ISandbox;
    session = new Session(mockSandbox);
  });

  it("should call setup() on the first ensureState call even if no dependency files exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));
    
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);
  });

  it("should NOT call setup() again when switching state if dependency file is the same", async () => {
    const depContent = "dependency-content-1";
    vi.mocked(fs.readFile).mockResolvedValue(depContent);
    
    // First ensureState (initial) - should call setup
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);
    
    // Second ensureState (same state, same file) - should NOT call setup again
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);
  });

  it("should call setup() when switching state if dependency file changes", async () => {
    // First state: pre
    vi.mocked(fs.readFile).mockResolvedValueOnce("content-pre");
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);
    
    // Now switch to post state with different content
    vi.mocked(fs.readFile).mockResolvedValueOnce("content-post");
    await session.ensureState("post", mockCandidate);
    
    expect(mockSandbox.setup).toHaveBeenCalledTimes(2);
  });

  it("should call setup() if the same state is requested but the dependency file has changed since last build", async () => {
    // Initial state
    vi.mocked(fs.readFile).mockResolvedValueOnce("content-1");
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);
    
    // Same state, but file changes
    vi.mocked(fs.readFile).mockResolvedValueOnce("content-2");
    await session.ensureState("pre", mockCandidate);
    
    expect(mockSandbox.setup).toHaveBeenCalledTimes(2);
  });

  it("should invalidate build if any of the multiple dependency files in a polyglot project change", async () => {
    // Setup: both package-lock.json and cargo.lock exist
    const readFileMock = vi.mocked(fs.readFile);
    
    const getMockImplementation = (pkgContent: string, cargoContent: string) => {
      return vi.fn().mockImplementation(async (path: string) => {
        if (path.endsWith("package-lock.json")) return pkgContent;
        if (path.endsWith("cargo.lock")) return cargoContent;
        throw new Error("File not found");
      });
    };

    readFileMock.mockImplementation(getMockImplementation("pkg-1", "cargo-1"));
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);

    // Change only cargo.lock
    readFileMock.mockImplementation(getMockImplementation("pkg-1", "cargo-2"));
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(2);

    // Change only package-lock.json
    readFileMock.mockImplementation(getMockImplementation("pkg-2", "cargo-2"));
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(3);
  });

  it("should call setup() again on the next ensureState call if the previous setup() failed", async () => {
    const depContent = "dependency-content";
    vi.mocked(fs.readFile).mockResolvedValue(depContent);

    // First setup fails
    mockSandbox.setup.mockRejectedValueOnce(new Error("Setup failed"));
    await expect(session.ensureState("pre", mockCandidate)).rejects.toThrow("Setup failed");
    expect(mockSandbox.setup).toHaveBeenCalledTimes(1);

    // Second ensureState call should call setup again
    mockSandbox.setup.mockResolvedValue(undefined);
    await session.ensureState("pre", mockCandidate);
    expect(mockSandbox.setup).toHaveBeenCalledTimes(2);
  });
});
