import { IAgentAdapter } from '../contracts/agent-adapter';
import { ClaudeCodeAdapter } from '../../infrastructure/agents/claude-code-adapter';
import { AiderAdapter } from '../../infrastructure/agents/aider-adapter';
import { DefaultAdapter } from './base-agent-adapter';

export class AgentAdapterFactory {
    private static adapters = new Map<string, new () => IAgentAdapter>();

    static {
        this.registerAdapter('claude-code', ClaudeCodeAdapter);
        this.registerAdapter('aider', AiderAdapter);
    }

    static registerAdapter(agentId: string, adapterClass: new () => IAgentAdapter) {
        this.adapters.set(agentId, adapterClass);
    }

    static createAdapter(agentId: string): IAgentAdapter {
        const AdapterClass = this.adapters.get(agentId);
        if (AdapterClass) {
            return new AdapterClass();
        }
        return new DefaultAdapter();
    }
}
