export interface IAgentAdapter {
    readonly name: string;
    readonly interactionMap: Map<RegExp, string>;
    getStartupCommand(): string;
}
