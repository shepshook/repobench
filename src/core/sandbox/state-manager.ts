import { ISandbox, SandboxState } from '../../types/contracts';

export class SandboxStateManager {
  private sandbox: ISandbox;
  private currentState: SandboxState = 'unknown';

  constructor(sandbox: ISandbox) {
    this.sandbox = sandbox;
  }

  async setPreFixState(commitHash: string): Promise<void> {
    await this.sandbox.switchToState(commitHash);
    this.currentState = 'pre-fix';
  }

  async setPostFixState(commitHash: string): Promise<void> {
    await this.sandbox.switchToState(commitHash);
    this.currentState = 'post-fix';
  }

  getCurrentState(): SandboxState {
    return this.currentState;
  }
}
