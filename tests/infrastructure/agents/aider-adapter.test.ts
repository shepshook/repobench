import { describe, it, expect } from 'vitest';
import { AiderAdapter } from '../../../src/infrastructure/agents/aider-adapter';

describe('AiderAdapter', () => {
    it('should return the correct startup command with --no-git flag', () => {
        const adapter = new AiderAdapter();
        const cmd = adapter.getStartupCommand();
        expect(cmd).toContain('aider');
        expect(cmd).toContain('--no-git');
    });

    it('should correctly map common Aider interaction prompts', () => {
        const adapter = new AiderAdapter();
        const interactionMap = adapter.interactionMap;

        const testCases = [
            {
                prompt: 'Would you like to commit these changes?',
                expectedResponse: 'yes',
            },
            {
                prompt: 'Would you like to add these files to the chat?',
                expectedResponse: 'yes',
            },
            {
                prompt: 'Do you want to use the current git branch?',
                expectedResponse: 'yes',
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
        const adapter = new AiderAdapter();
        const interactionMap = adapter.interactionMap;
        const output = 'I have finished the task. Here is the diff:';

        const matchedResponse = Array.from(interactionMap.entries()).find(([regex]) => 
            regex.test(output)
        );

        expect(matchedResponse).toBeUndefined();
    });
});
