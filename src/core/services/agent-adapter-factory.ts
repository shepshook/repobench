import { IAgentAdapter } from '../contracts/agent-adapter';
import { DefaultAdapter } from './base-agent-adapter';
import { AgentConfig, AgentConfigSchema } from '../contracts';

type AdapterCtor = new () => IAgentAdapter;

export class AgentAdapterFactory {
    private static adapters = new Map<string, AdapterCtor>();

    static registerAdapter(agentId: string, adapterClass: new () => IAgentAdapter) {
        this.adapters.set(agentId, adapterClass);
    }

    static createAdapter(config: string | AgentConfig): IAgentAdapter {
        let agentId: string;

        if (typeof config === 'string') {
            agentId = config;
        } else {
            const result = AgentConfigSchema.safeParse(config);
            if (!result.success) {
                throw new Error(`Invalid AgentConfig: ${result.error.message}`);
            }
            agentId = result.data.agentId;
        }

        const AdapterClass = this.adapters.get(agentId);
        if (AdapterClass) {
            return new AdapterClass();
        }
        return new DefaultAdapter();
    }
}
