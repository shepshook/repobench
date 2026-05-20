import { describe, it, expect, beforeEach } from 'vitest';
import { PromptHandler } from '../../../src/core/services/prompt-handler';
import { InteractionRule } from '../../../src/core/contracts';

describe('PromptHandler', () => {
  let promptHandler: PromptHandler;

  beforeEach(() => {
    promptHandler = new PromptHandler();
  });

  describe('Basic Matching', () => {
    it('should return the response when the prompt pattern matches', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Do you want to continue\\? \\[y/n\\]', response: 'y' },
      ];
      promptHandler.setRules(rules);
      
      const result = promptHandler.handle('Do you want to continue? [y/n]');
      expect(result).toBe('y');
    });

    it('should return null when no prompt pattern matches', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Do you want to continue\\? \\[y/n\\]', response: 'y' },
      ];
      promptHandler.setRules(rules);
      
      const result = promptHandler.handle('Some other output');
      expect(result).toBeNull();
    });

    it('should return null when no rules are set', () => {
      const result = promptHandler.handle('Do you want to continue? [y/n]');
      expect(result).toBeNull();
    });
  });

  describe('Safety & Security', () => {
    it('should allow simple alphanumeric responses', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Prompt:', response: 'yes' },
      ];
      promptHandler.setRules(rules);
      expect(promptHandler.handle('Prompt:')).toBe('yes');
    });

    it('should reject responses containing dangerous shell characters', () => {
      const dangerousResponses = [
        'y; rm -rf /',
        'y && ls',
        'y | grep foo',
        'y `whoami`',
        'y $(whoami)',
        'y > /dev/null',
        'y < /etc/passwd',
      ];

      dangerousResponses.forEach(response => {
        const rules: InteractionRule[] = [
          { pattern: 'Prompt:', response: response },
        ];
        promptHandler.setRules(rules);
        expect(promptHandler.handle('Prompt:')).toBeNull();
      });
    });

    it('should reject responses that are too long (> 100 characters)', () => {
      const longResponse = 'a'.repeat(101);
      const rules: InteractionRule[] = [
        { pattern: 'Prompt:', response: longResponse },
      ];
      promptHandler.setRules(rules);
      expect(promptHandler.handle('Prompt:')).toBeNull();
    });

    it('should allow responses up to 100 characters if they are safe', () => {
      const safeLongResponse = 'a'.repeat(100);
      const rules: InteractionRule[] = [
        { pattern: 'Prompt:', response: safeLongResponse },
      ];
      promptHandler.setRules(rules);
      expect(promptHandler.handle('Prompt:')).toBe(safeLongResponse);
    });
  });

  describe('High-Volume / Fragmented Output (Regression)', () => {
    it('should match a prompt that is split across multiple chunks', () => {
      const rules: InteractionRule[] = [
        { pattern: 'Do you want to continue\\? \\[y/n\\]', response: 'y' },
      ];
      promptHandler.setRules(rules);
      
      // Simulate high-volume PTY output where a prompt is fragmented
      const chunk1 = 'Do you want ';
      const chunk2 = 'to continue? [y/n]';
      
      // This should ideally match once the full prompt is received
      const result1 = promptHandler.handle(chunk1);
      const result2 = promptHandler.handle(chunk2);
      
      // This should now match once the full prompt is received thanks to buffering.
      expect(result1 === 'y' || result2 === 'y').toBe(true);

    });
  });
});
