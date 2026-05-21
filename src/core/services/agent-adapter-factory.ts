import { IAgentAdapter } from '../contracts/agent-adapter';
import { ClaudeCodeAdapter } from '../../infrastructure/agents/claude-code-adapter';
import { AiderAdapter } from '../../infrastructure/agents/aider-adapter';
import { DefaultAdapter } from './base-agent-adapter';
import { AgentConfig, AgentConfigSchema } from '../contracts';

export class AgentAdapterFactory {
    private static adapters = new Map<string, new () => IAgentAdapter>();

    static {
        this.registerAdapter('claude-code', ClaudeCodeAdapter);
        this.registerAdapter('aider', AiderAdapter);
    }

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
