import { AgentAdapter } from '../../core/services/base-agent-adapter';

export class OpencodeAdapter extends AgentAdapter {
    constructor() {
        super(
            'Opencode',
            new Map([
                [/(Allow|Would you like to) opencode.*(run|execute|write|modify|create|read).*\[y\/n\]/i, 'y'],
                [/Allow opencode to (run|execute|write|modify|create|read).*\?/i, 'y'],
                [/Continue with operation\? \[y\/n\]/i, 'y'],
                [/Do you want to continue\?.*\[y\/n\]/i, 'y'],
                [/\[y\/n\]/, 'y'],
            ])
        );
    }

    getStartupCommand(): string {
        const baseCmd = 'opencode';
        return this.config?.cliArgs?.length
            ? `${baseCmd} ${this.config.cliArgs.join(' ')}`
            : baseCmd;
    }
}

export default OpencodeAdapter;
