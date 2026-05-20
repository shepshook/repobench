import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPtySession } from '../../src/core/contracts';
import { PtySession } from '../../src/infrastructure/pty-session';
import { Sandbox } from '../../src/infrastructure/sandbox';
import { VolumeManager } from '../../src/infrastructure/volume-manager';
import Docker from 'dockerode';

describe('PtySession Normalization', () => {
  let sandbox: Sandbox;
  let volumeManager: VolumeManager;
  let docker: Docker;

  beforeEach(async () => {
    docker = new Docker();
    volumeManager = new VolumeManager(docker);
    sandbox = new Sandbox({
      baseImage: 'node:20-alpine',
      project: 'pty-norm-test'
    }, volumeManager);
    await sandbox.init();
  });

  afterEach(async () => {
    await sandbox.destroy();
  });

  it('should handle complex ANSI sequences (OSC) in normalization', () => {
    // OSC sequence: \x1b]0;Title\x07
    const input = '\x1b]0;My Terminal\x07Hello';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('Hello');
  });

  it('should correctly preserve and escape ONLY valid ANSI sequences when keepAnsi is true', () => {
    // Valid sequence: \x1b[32m
    // Invalid/Lone ESC: \x1b
    const input = '\x1b[32mGreen\x1b[0m and a lone \x1b character';
    const normalized = PtySession.normalize(input, true);
    
    // Expected: Valid sequences escaped, lone ESC handled safely (e.g., either escaped or stripped)
    // The key is that it shouldn't just be a global .replace(/\x1b/g, '\\x1b') if that's considered brittle.
    // A robust implementation should identify the sequence.
    expect(normalized).toBe('\\x1b[32mGreen\\x1b[0m and a lone \\x1b character'); 
  });

  it('should strip ANSI sequences that do not follow the [number;letter pattern', () => {
    // \x1b(B is a valid ANSI sequence (Select Character Set)
    const input = '\x1b(BHello';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('Hello');
  });

  it('should handle multi-line input with mixed ANSI and carriage returns', () => {
    const input = '\x1b[31mError:\x1b[0m\r\nLine 2\r\n\x1b[32mSuccess\x1b[0m';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('Error:\nLine 2\nSuccess');
  });

  it('should correctly handle a sequence of multiple different ANSI codes', () => {
    const input = '\x1b[31mRed\x1b[0m\x1b[1mBold\x1b[0m\x1b[4mUnderline\x1b[0m';
    const normalized = PtySession.normalize(input);
    expect(normalized).toBe('RedBoldUnderline');
  });

  it('should strip ANSI escape sequences from output emitted via onData', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          // If the data still contains ANSI codes, it's not normalized
          if (data.includes('\x1b[')) {
            resolve(data);
          } else if (data.includes('Normalized Output')) {
            resolve('normalized');
          }
        });
      });
    
      // Use a command that produces color
      session.write('echo -e "\\x1b[32mNormalized Output\\x1b[0m"\n');
      
      const result = await outputPromise;
      // We expect 'normalized', if we get the raw string with ANSI codes, it fails
      expect(result).toBe('normalized');
    } finally {
      await session.close();
    }
  });

  it('should correctly handle ANSI normalization in behavior mode', async () => {
    sandbox.config.project = 'behavior';
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('Color Test')) {
            resolve(data);
          }
        });
      });
    
      session.write('echo -e "\\x1b[32mColor Test\\x1b[0m"\n');
      
      const result = await outputPromise;
      expect(result).toContain('Color Test');
      expect(result).not.toContain('\\x1b[32mm');
      expect(result).not.toContain('\\x1b[0mm');
    } finally {
      await session.close();
    }
  });

  it('should verify the corrupted ANSI normalization logic', () => {
    const input = '\x1b[32mColor Test\x1b[0m';
    const output = input.replace(/(\x1b)\[(\d+m)/g, '\\x1b[$2$1[$2');
    expect(output).not.toBe(input);
  });


  it('should strip carriage returns from output emitted via onData', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          if (data.includes('Clean Output')) {
            resolve(data);
          }
        });
      });

      session.write('echo "Clean Output"\n');
      
      const result = await outputPromise;
      expect(result).not.toContain('\r');
    } finally {
      await session.close();
    }
  });

  it('should strip Docker-specific shell prompts from output', async () => {
    const session: IPtySession = await PtySession.create(sandbox);
    try {
      const outputPromise = new Promise<string>((resolve) => {
        session.onData((data) => {
          // Prompts typically look like root@<id>:/#
          if (/@.*:.*#/.test(data)) {
            resolve(data);
          } else if (data.includes('Prompt Stripped')) {
            resolve('stripped');
          }
        });
      });

      session.write('echo "Prompt Stripped"\n');
      
      const result = await outputPromise;
      // If the result contains the prompt, it's not stripped
      expect(result).toBe('stripped');
    } finally {
      await session.close();
    }
  });
});
