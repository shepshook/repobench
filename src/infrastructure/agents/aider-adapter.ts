import { AgentAdapter } from '../../core/services/base-agent-adapter';

export class AiderAdapter extends AgentAdapter {
    constructor() {
        super(
            'Aider',
            new Map([
                [/Would you like to commit these changes\?/, 'yes'],
                [/Would you like to add these files to the chat\?/, 'yes'],
                [/Do you want to use the current git branch\?/, 'yes'],
            ])
        );
    }

    getStartupCommand(): string {
        const baseCmd = 'aider --no-git';
        return this.config?.cliArgs?.length 
            ? `${baseCmd} ${this.config.cliArgs.join(' ')}` 
            : baseCmd;
    }
}
