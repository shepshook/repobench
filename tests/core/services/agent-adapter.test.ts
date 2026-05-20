import { describe, it, expect } from 'vitest';
import { AgentAdapter } from '../../../src/core/services/base-agent-adapter';

class MockAgentAdapter extends AgentAdapter {
    getStartupCommand(): string {
        return 'mock-startup-cmd';
    }
}

describe('AgentAdapter', () => {
    it('should correctly assign name and interactionMap through constructor', () => {
        const name = 'TestAgent';
        const helloRegex = /hello/i;
        const byeRegex = /bye/i;
        const interactionMap = new Map([
            [helloRegex, 'hi'],
            [byeRegex, 'goodbye']
        ]);

        const adapter = new MockAgentAdapter(name, interactionMap);

        expect(adapter.name).toBe(name);
        expect(adapter.interactionMap).toBe(interactionMap);
        expect(adapter.interactionMap.get(helloRegex)).toBe('hi');
    });

    it('should correctly implement and return the startup command', () => {
        const adapter = new MockAgentAdapter('TestAgent', new Map());
        expect(adapter.getStartupCommand()).toBe('mock-startup-cmd');
    });
});
