import { AgentAdapter } from '../adapter';

export class AiderAdapter extends AgentAdapter {
  protected shell = 'aider';

  protected getArgs(options: Record<string, string | string[]>): string[] {
    const args: string[] = [];
    if (!options.model) {
      throw new Error('AiderAdapter requires a model option');
    }
    args.push('--model', options.model as string);
    args.push('--no-git');
    args.push(...this.expandArgs(options.extraArgs));
    return args;
  }

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
