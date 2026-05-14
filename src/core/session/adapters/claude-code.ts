import { AgentAdapter } from '../adapter';

export class ClaudeCodeAdapter extends AgentAdapter {
  protected spawnCommand = 'claude {{extraArgs}}';

  constructor() {
    super();
    this.setupInteractions();
  }

  private setupInteractions(): void {
    this.addInteraction(/Run this command\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Allow this change\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Apply changes\?\s*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Continue\?\s*\(y\/n\)/i, 'y\n');
  }
}
