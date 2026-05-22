import { AgentAdapter } from '../../core/services/base-agent-adapter';

export class ClaudeCodeAdapter extends AgentAdapter {
    constructor() {
        super(
            'ClaudeCode',
            new Map([
                [/Allow Claude to run this command\? \[y\/n\]/, 'y'],
                [/Apply these changes\? \[y\/n\]/, 'y'],
                [/Would you like to commit these changes\? \[y\/n\]/, 'y'],
                [/Allow Claude to read this file\? \[y\/n\]/, 'y'],
                [/Allow Claude to write to this file\? \[y\/n\]/, 'y'],
            ])
        );
    }

    getStartupCommand(): string {
        const baseCmd = 'claude';
        return this.config?.cliArgs?.length 
            ? `${baseCmd} ${this.config.cliArgs.join(' ')}` 
            : baseCmd;
    }
}

export default ClaudeCodeAdapter;
