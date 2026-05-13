import { ISandbox } from "../types/contracts";

export interface StateCandidate {
  preFixHash: string;
  postFixHash: string;
}

export type SandboxState = "pre" | "post" | null;

export class SandboxStateManager {
  private currentState: SandboxState = null;

  getCurrentState(): SandboxState {
    return this.currentState;
  }

  async ensureState(
    sandbox: ISandbox,
    targetState: "pre" | "post",
    candidate: StateCandidate
  ): Promise<void> {
    if (this.currentState === targetState) {
      return;
    }

    const commitHash = targetState === "pre" ? candidate.preFixHash : candidate.postFixHash;
    await sandbox.switchToState(commitHash);
    this.currentState = targetState;
  }
}

