import { AgentAdapter } from '../adapter';

export class AiderAdapter extends AgentAdapter {
  protected spawnCommand = 'aider --model {{model}} --no-git {{extraArgs}}';

  constructor() {
    super();
    this.setupInteractions();
  }

  private setupInteractions(): void {
    // Common Aider prompts
    this.addInteraction(/Do you want to run the tests\?/i, 'Yes\n');
    this.addInteraction(/Apply changes to file.*\(y\/n\)/i, 'y\n');
    this.addInteraction(/Continue\?/i, 'y\n');
    this.addInteraction(/Confirm\?/i, 'y\n');
  }
}
