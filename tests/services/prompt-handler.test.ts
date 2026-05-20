import { describe, it, expect, beforeEach } from 'vitest';
import { PromptHandler } from '../../src/core/services/prompt-handler';
import { InteractionRule } from '../../src/core/contracts';

describe('PromptHandler Integration & Verification', () => {
  let promptHandler: PromptHandler;

  beforeEach(() => {
    promptHandler = new PromptHandler();
  });

  describe('Contract Validation (Zod)', () => {
    it('should throw a validation error when invalid rules are provided to setRules', () => {
      // This will FAIL because setRules currently does not use Zod validation
      const invalidRules = [
        { pattern: 123, response: 'y' } as any,
      ];
      expect(() => promptHandler.setRules(invalidRules)).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw an error when invalid regex patterns are provided to setRules', () => {
      const rules: InteractionRule[] = [
        { pattern: '[', response: 'y' }, // Invalid regex
      ];
      // Per ARCHITECTURE.md §4.3, this should bubble up the error, not fail silently.
      expect(() => promptHandler.setRules(rules)).toThrow();
    });
  });

  describe('High-Volume / Race Conditions', () => {
    it('should match a prompt when delivered character-by-character', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Confirm action\\? \\[y/n\\]', response: 'y' },
      ];
      promptHandler.setRules(rules);
      
      const prompt = 'Confirm action? [y/n]';
      let result: string | null = null;
      
      for (const char of prompt) {
        const res = promptHandler.handle(char);
        if (res) {
          result = res;
          break;
        }
      }
      
      expect(result).toBe('y');
    });

    it('should match a prompt even if the buffer has rotated due to MAX_BUFFER_SIZE', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Target Prompt', response: 'matched' },
      ];
      promptHandler.setRules(rules);
      
      // Fill buffer beyond MAX_BUFFER_SIZE (4096)
      const filler = 'a'.repeat(5000);
      promptHandler.handle(filler);
      
      // Now send the prompt
      const result = promptHandler.handle('Target Prompt');
      expect(result).toBe('matched');
    });

    it('should correctly handle multiple overlapping prompts in a high-volume stream', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Prompt A', response: 'respA' },
        { pattern: 'Prompt B', response: 'respB' },
      ];
      promptHandler.setRules(rules);

      // Send a stream that contains both, but B comes after A
      const stream = 'Some data... Prompt A... More data... Prompt B';
      
      // We expect it to match the first one it encounters
      const result = promptHandler.handle(stream);
      expect(result).toBe('respA');
      
      // After matching A, the buffer is cleared. Now send the rest.
      const result2 = promptHandler.handle('... More data... Prompt B');
      expect(result2).toBe('respB');
    });

    it('should not match a prompt if it was partially rotated out of the buffer', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Long Prompt That Spans The Boundary', response: 'matched' },
      ];
      promptHandler.setRules(rules);
      
      const prompt = 'Long Prompt That Spans The Boundary';
      const halfPrompt = prompt.substring(0, prompt.length / 2);
      const otherHalf = prompt.substring(prompt.length / 2);
      
      // Fill buffer to almost the limit
      promptHandler.handle('a'.repeat(4096 - 10));
      
      // Send the first half of the prompt
      promptHandler.handle(halfPrompt);
      
      // Send enough data to push the first half out of the buffer
      promptHandler.handle('b'.repeat(4096));
      
      // Now send the second half
      const result = promptHandler.handle(otherHalf);
      expect(result).toBeNull();
    });

    it('should update matching behavior when rules are changed mid-stream', () => {
      const rules1: InteractionRule[] = [
        { pattern: 'Prompt A', response: 'respA' },
      ];
      promptHandler.setRules(rules1);
      
      expect(promptHandler.handle('Prompt A')).toBe('respA');
      
      const rules2: InteractionRule[] = [
        { pattern: 'Prompt B', response: 'respB' },
      ];
      promptHandler.setRules(rules2);
      
      expect(promptHandler.handle('Prompt A')).toBeNull();
      expect(promptHandler.handle('Prompt B')).toBe('respB');
    });
  });


  describe('Safety & Malicious Edit Rejection', () => {
    it('should reject responses that attempt to escape the shell via complex sequences', () => {
      const dangerousResponses = [
        'y\nrm -rf /',
        'y\rwhoami',
        'y\x1b[2J', // ANSI escape sequence
        'y\x00',    // Null byte
        'y; ls',
        'y && id',
        'y | cat /etc/passwd',
        'y $(whoami)',
        'y `id`',
      ];

      dangerousResponses.forEach(response => {
        const rules: InteractionRule[] = [
          { pattern: 'Prompt:', response: response },
        ];
        promptHandler.setRules(rules);
        expect(promptHandler.handle('Prompt:')).toBeNull();
      });
    });

    it('should reject responses containing non-printable control characters', () => {
      const controlChars = [
        'y\x01',
        'y\x07', // Bell
        'y\x08', // Backspace
        'y\x1F',
      ];

      controlChars.forEach(response => {
        const rules: InteractionRule[] = [
          { pattern: 'Prompt:', response: response },
        ];
        promptHandler.setRules(rules);
        expect(promptHandler.handle('Prompt:')).toBeNull();
      });
    });

    it('should allow safe responses with spaces and basic punctuation', () => {
      const safeResponses = [
        'yes, please',
        'no, thanks',
        'option 1',
        'Confirmed.',
        'y/n: y',
      ];

      safeResponses.forEach(response => {
        const rules: InteractionRule[] = [
          { pattern: 'Prompt:', response: response },
        ];
        promptHandler.setRules(rules);
        expect(promptHandler.handle('Prompt:')).toBe(response);
      });
    });
  });
});
