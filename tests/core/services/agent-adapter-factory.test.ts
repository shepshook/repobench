import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAdapterFactory } from '../../../src/core/services/agent-adapter-factory';
import { ClaudeCodeAdapter } from '../../../src/infrastructure/agents/claude-code-adapter';
import { AiderAdapter } from '../../../src/infrastructure/agents/aider-adapter';
import { DefaultAdapter } from '../../../src/core/services/base-agent-adapter';
import { AgentAdapter } from '../../../src/core/services/base-agent-adapter';

class MockCustomAdapter extends AgentAdapter {
    getStartupCommand(): string {
        return 'custom-cmd';
    }
}

describe('AgentAdapterFactory', () => {
    beforeEach(() => {
        // Reset factory state if possible, but since it's static and 
        // uses a static block for registration, we just need to be aware of it.
        // The factory doesn't have a reset method, so we'll just add new ones.
    });

    it('should return ClaudeCodeAdapter for "claude-code"', () => {
        const adapter = AgentAdapterFactory.createAdapter('claude-code');
        expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
    });

    it('should return AiderAdapter for "aider"', () => {
        const adapter = AgentAdapterFactory.createAdapter('aider');
        expect(adapter).toBeInstanceOf(AiderAdapter);
    });

    it('should return DefaultAdapter for unknown agentId', () => {
        const adapter = AgentAdapterFactory.createAdapter('unknown-agent');
        expect(adapter).toBeInstanceOf(DefaultAdapter);
    });

    it('should allow registering and creating a custom adapter', () => {
        const agentId = 'custom-agent';
        AgentAdapterFactory.registerAdapter(agentId, MockCustomAdapter);
        
        const adapter = AgentAdapterFactory.createAdapter(agentId);
        expect(adapter).toBeInstanceOf(MockCustomAdapter);
        expect(adapter.getStartupCommand()).toBe('custom-cmd');
    });
});
