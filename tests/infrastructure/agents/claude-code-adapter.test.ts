import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../../../src/infrastructure/agents/claude-code-adapter';

describe('ClaudeCodeAdapter', () => {
    it('should return the correct startup command', () => {
        const adapter = new ClaudeCodeAdapter();
        const cmd = adapter.getStartupCommand();
        expect(cmd).toContain('claude');
    });

    it('should correctly map common ClaudeCode interaction prompts', () => {
        const adapter = new ClaudeCodeAdapter();
        const interactionMap = adapter.interactionMap;

        const testCases = [
            {
                prompt: 'Allow Claude to run this command? [y/n]',
                expectedResponse: 'y',
            },
            {
                prompt: 'Apply these changes? [y/n]',
                expectedResponse: 'y',
            },
            {
                prompt: 'Would you like to commit these changes? [y/n]',
                expectedResponse: 'y',
            },
            {
                prompt: 'Allow Claude to read this file? [y/n]',
                expectedResponse: 'y',
            },
            {
                prompt: 'Allow Claude to write to this file? [y/n]',
                expectedResponse: 'y',
            },
        ];

        for (const { prompt, expectedResponse } of testCases) {
            const matchedResponse = Array.from(interactionMap.entries()).find(([regex]) => 
                regex.test(prompt)
            );
            
            expect(matchedResponse, `Prompt "${prompt}" should be matched`).toBeDefined();
            expect(matchedResponse?.[1], `Prompt "${prompt}" should return "${expectedResponse}"`).toBe(expectedResponse);
        }
    });

    it('should not match irrelevant output', () => {
        const adapter = new ClaudeCodeAdapter();
        const interactionMap = adapter.interactionMap;
        const output = 'I have finished the task. Here is the diff:';

        const matchedResponse = Array.from(interactionMap.entries()).find(([regex]) => 
            regex.test(output)
        );

        expect(matchedResponse).toBeUndefined();
    });
});
