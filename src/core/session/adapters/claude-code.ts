import { AgentAdapter } from '../adapter';

export class ClaudeCodeAdapter extends AgentAdapter {
  protected shell = 'claude';

  protected getArgs(options: Record<string, string | string[]>): string[] {
    return [...this.expandArgs(options.extraArgs)];
  }

  constructor() {
    super();
    this.setupInteractions();
  }

  private setupInteractions(): void {
    this.addInteraction(/Run this command\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Allow this change\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Apply changes\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Continue\?\s*\(y\/n\)/i, 'y\n');

    // Done signatures
    this.doneSignatures = [
      /I've completed the task/i,
      /The task is now finished/i,
      /Everything is set up and working/i,
    ];
  }
}
