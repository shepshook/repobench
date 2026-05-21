import { AgentConfig } from '../contracts';

export interface IAgentAdapter {
    readonly name: string;
    readonly interactionMap: Map<RegExp, string>;
    getStartupCommand(): string;
    configure(config: AgentConfig): void;
}
