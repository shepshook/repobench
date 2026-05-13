import { ISandbox } from "../types/contracts";
import fs from "fs/promises";
import crypto from "crypto";
import path from "path";

export interface StateCandidate {
  preFixHash: string;
  postFixHash: string;
}

export type SandboxState = "pre" | "post" | null;

export interface EnsureStateResult {
  stateChanged: boolean;
  needsRebuild: boolean;
  currentHash: string | null;
}

export class SandboxStateManager {
  private currentState: SandboxState = null;
  private lastBuildHash: string | null = "__INITIAL__";

  getCurrentState(): SandboxState {
    return this.currentState;
  }

  confirmBuildSuccess(hash: string | null): void {
    this.lastBuildHash = hash;
  }

  private async calculateBuildHash(sandbox: ISandbox): Promise<string | null> {
    const workingDir = await sandbox.getWorkingDir();
    const depFiles = ["package-lock.json", "yarn.lock", "cargo.lock", "poetry.lock", "requirements.txt", "go.sum", "Gemfile.lock"];
    
    const hashes: string[] = [];
    for (const file of depFiles) {
      try {
        const filePath = path.join(workingDir, file);
        const content = await fs.readFile(filePath);
        hashes.push(crypto.createHash("sha256").update(content).digest("hex"));
      } catch {
        // File not found, try next
      }
    }

    if (hashes.length === 0) return null;
    return crypto.createHash("sha256").update(hashes.join(",")).digest("hex");
  }

  async ensureState(
    sandbox: ISandbox,
    targetState: "pre" | "post",
    candidate: StateCandidate
  ): Promise<EnsureStateResult> {
    let stateChanged = false;
    if (this.currentState !== targetState) {
      const commitHash = targetState === "pre" ? candidate.preFixHash : candidate.postFixHash;
      await sandbox.switchToState(commitHash);
      this.currentState = targetState;
      stateChanged = true;
    }

    const currentHash = await this.calculateBuildHash(sandbox);
    let needsRebuild = false;
    if (currentHash !== this.lastBuildHash) {
      needsRebuild = true;
    }

    return { stateChanged, needsRebuild, currentHash };
  }
}


