import { IAgentAdapter } from '../contracts/agent-adapter';
import { AgentConfig } from '../contracts';

export abstract class AgentAdapter implements IAgentAdapter {
    constructor(
        public readonly name: string,
        public readonly interactionMap: Map<RegExp, string>
    ) {}

    abstract getStartupCommand(): string;
    
    configure(config: AgentConfig): void {
        // Default implementation: do nothing
    }
}

export class DefaultAdapter extends AgentAdapter {
    constructor(name: string = 'Default', startupCmd: string = 'sh') {
        super(name, new Map());
        this._startupCmd = startupCmd;
    }

    private _startupCmd: string;

    getStartupCommand(): string {
        return this._startupCmd;
    }

    configure(config: AgentConfig): void {
        this._startupCmd = config.cliArgs.length > 0 
            ? `${this._startupCmd} ${config.cliArgs.join(' ')}`
            : this._startupCmd;
    }
}


