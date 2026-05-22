import { describe, it, expect, vi } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';
import { AnsiProcessor } from '../../src/infrastructure/ansi-processor';
import { Sandbox } from '../../src/infrastructure/sandbox';

describe('PtySession Normalization Regression', () => {
  const testCases = [
    {
      name: 'Simple color',
      input: '\x1b[32mSuccess\x1b[0m',
      expectedDefault: 'Success',
      expectedBehavior: '\\x1b[32mSuccess\\x1b[0m',
    },
    {
      name: 'Bold red',
      input: '\x1b[1;31mError\x1b[0m',
      expectedDefault: 'Error',
      expectedBehavior: '\\x1b[1;31mError\\x1b[0m',
    },
    {
      name: 'Underline',
      input: '\x1b[4mUnderlined\x1b[0m',
      expectedDefault: 'Underlined',
      expectedBehavior: '\\x1b[4mUnderlined\\x1b[0m',
    },
    {
      name: 'Cursor movement',
      input: 'Hello\x1b[1AWorld',
      expectedDefault: 'HelloWorld',
      expectedBehavior: 'Hello\\x1b[1AWorld',
    },
    {
      name: 'Complex sequence',
      input: '\x1b[2J\x1b[HClear Screen',
      expectedDefault: 'Clear Screen',
      expectedBehavior: '\\x1b[2J\\x1b[HClear Screen',
    },
    {
      name: 'Mixed content',
      input: 'Normal \x1b[34mBlue\x1b[0m Normal',
      expectedDefault: 'Normal Blue Normal',
      expectedBehavior: 'Normal \\x1b[34mBlue\\x1b[0m Normal',
    },
    {
      name: 'ANSI in prompt',
      input: '\x1b[32muser@host:~/dir$ \r\nSuccess',
      expectedDefault: 'Success',
      expectedBehavior: '\\x1b[32muser@host:~/dir$ \nSuccess',
    },
  ];

  testCases.forEach(({ name, input, expectedDefault, expectedBehavior }) => {
    it(`should correctly normalize ${name} (default)`, async () => {
      const sandbox = { 
        config: { project: 'default-project' },
        isSimulation: true 
      } as any;
      
      const isBehavior = sandbox.config.project?.includes('behavior');
      let output = PtySession.normalize(input, isBehavior);
      if (isBehavior) {
        output = output.replace(/\x1b/g, '\\x1b');
      }
      
      expect(output).toBe(expectedDefault);
    });

    it(`should correctly preserve ${name} (behavior project)`, async () => {
      const sandbox = { 
        config: { project: 'behavior-project' },
        isSimulation: true 
      } as any;
      
      const isBehavior = sandbox.config.project?.includes('behavior');
      let output = PtySession.normalize(input, isBehavior);
      if (isBehavior) {
        output = output.replace(/\x1b/g, '\\x1b');
      }
      
      expect(output).toBe(expectedBehavior);
    });
  });

  it('should handle empty input', () => {
    const sandbox = { 
      config: { project: 'default-project' },
      isSimulation: true 
    } as any;
    const isBehavior = sandbox.config.project?.includes('behavior');
    let output = PtySession.normalize('', isBehavior);
    if (isBehavior) output = output.replace(/\x1b/g, '\\x1b');
    expect(output).toBe('');
  });

  it('should handle input without ANSI codes', () => {
    const input = 'Plain text output';
    const sandbox = { 
      config: { project: 'default-project' },
      isSimulation: true 
    } as any;
    const isBehavior = sandbox.config.project?.includes('behavior');
    let output = PtySession.normalize(input, isBehavior);
    if (isBehavior) output = output.replace(/\x1b/g, '\\x1b');
    expect(output).toBe(input);
  });

  it('should handle carriage returns and prompts', () => {
    const input = 'user@host:~/dir$ \r\nWelcome!';
    const sandbox = { 
      config: { project: 'default-project' },
      isSimulation: true 
    } as any;
    const isBehavior = sandbox.config.project?.includes('behavior');
    let output = PtySession.normalize(input, isBehavior);
    if (isBehavior) output = output.replace(/\x1b/g, '\\x1b');
    expect(output).toBe('Welcome!');
  });
});

describe('FIX4 Regression — Removed _writtenCommands parameter', () => {
  describe('AnsiProcessor.normalize (direct, not through PtySession)', () => {
    it('should handle plain text with no ANSI or prompts', () => {
      const result = AnsiProcessor.normalize('hello world');
      expect(result).toBe('hello world');
    });

    it('should strip ANSI in default mode (keepAnsi=false)', () => {
      const result = AnsiProcessor.normalize('\x1b[32mSuccess\x1b[0m');
      expect(result).toBe('Success');
    });

    it('should escape ANSI in behavior mode (keepAnsi=true)', () => {
      const result = AnsiProcessor.normalize('\x1b[32mColor Test\x1b[0m', true);
      expect(result).toBe('\\x1b[32mColor Test\\x1b[0m');
    });

    it('should handle carriage returns and prompt stripping', () => {
      const result = AnsiProcessor.normalize('user@host:~/dir$ \r\nOutput');
      expect(result).toBe('Output');
    });

    it('should work when called with only the data argument (keepAnsi defaults to false)', () => {
      const result = AnsiProcessor.normalize('\x1b[1;31mError\x1b[0m');
      expect(result).toBe('Error');
    });
  });

  describe('PtySession.normalize signature validation', () => {
    it('should work with exactly 2 arguments — default mode', () => {
      const result = PtySession.normalize('plain text');
      expect(result).toBe('plain text');
    });

    it('should work with exactly 2 arguments — behavior mode', () => {
      const result = PtySession.normalize('\x1b[32mGreen\x1b[0m', true);
      expect(result).toBe('\\x1b[32mGreen\\x1b[0m');
    });
  });
});
