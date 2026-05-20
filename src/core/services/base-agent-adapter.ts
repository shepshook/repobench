import { IAgentAdapter } from '../contracts/agent-adapter';

export abstract class AgentAdapter implements IAgentAdapter {
    constructor(
        public readonly name: string,
        public readonly interactionMap: Map<RegExp, string>
    ) {}

    abstract getStartupCommand(): string;
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
}


