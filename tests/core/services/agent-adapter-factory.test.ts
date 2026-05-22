import { describe, it, expect, beforeEach } from 'vitest';
import { AgentAdapterFactory } from '../../../src/core/services/agent-adapter-factory';
import { ClaudeCodeAdapter } from '../../../src/infrastructure/agents/claude-code-adapter';
import { AiderAdapter } from '../../../src/infrastructure/agents/aider-adapter';
import { DefaultAdapter } from '../../../src/core/services/base-agent-adapter';
import { AgentAdapter } from '../../../src/core/services/base-agent-adapter';
import { AgentConfig } from '../../../src/core/contracts';

class MockCustomAdapter extends AgentAdapter {
    getStartupCommand(): string {
        return 'custom-cmd';
    }
}

describe('AgentAdapterFactory', () => {
    beforeAll(() => {
        // Register known adapters explicitly (composition root responsibility).
        // This ensures tests are not coupled to any static initializer in the factory itself.
        AgentAdapterFactory.registerAdapter('claude-code', ClaudeCodeAdapter);
        AgentAdapterFactory.registerAdapter('aider', AiderAdapter);
    });

    it('should return ClaudeCodeAdapter for "claude-code"', () => {
        const adapter = AgentAdapterFactory.createAdapter('claude-code');
        expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
    });

    it('should return AiderAdapter for "aider"', () => {
        const adapter = AgentAdapterFactory.createAdapter('aider');
        expect(adapter).toBeInstanceOf(AiderAdapter);
    });

    it('should return DefaultAdapter for unknown agentId when no adapter is registered', () => {
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

    it('should return a registered adapter when provided with a valid AgentConfig', () => {
        const config: AgentConfig = {
            agentId: 'claude-code',
            model: 'claude-3-5-sonnet',
            temperature: 0,
            systemPrompt: 'You are a helpful assistant',
            cliArgs: [],
        };
        const adapter = AgentAdapterFactory.createAdapter(config);
        expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
    });

    it('should throw validation error when provided with an invalid AgentConfig', () => {
        const invalidConfig = {
            agentId: 'invalid-agent',
            // missing other required fields
        };
        expect(() => AgentAdapterFactory.createAdapter(invalidConfig as any)).toThrow();
    });

    it('should return DefaultAdapter when provided with a valid AgentConfig but unknown name', () => {
        const config: AgentConfig = {
            agentId: 'unknown-agent',
            model: 'gpt-4',
            temperature: 0.7,
            systemPrompt: 'You are a helpful assistant',
            cliArgs: [],
        };
        const adapter = AgentAdapterFactory.createAdapter(config);
        expect(adapter).toBeInstanceOf(DefaultAdapter);
    });

    it('should update startup command in DefaultAdapter when configured with cliArgs', () => {
        const adapter = new DefaultAdapter('test', 'sh');
        const config: AgentConfig = {
            agentId: 'test',
            model: 'gpt-4',
            temperature: 0.7,
            systemPrompt: '...',
            cliArgs: ['-v', '--debug'],
        };
        adapter.configure(config);
        expect(adapter.getStartupCommand()).toBe('sh -v --debug');
    });
});
