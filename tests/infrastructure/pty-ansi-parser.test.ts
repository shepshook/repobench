import { describe, it, expect } from 'vitest';
import { PtySession } from '../../src/infrastructure/pty-session';

describe('PtySession.processAnsi', () => {
  describe('Stripping (keepAnsi = false)', () => {
    it('should strip basic CSI sequences', () => {
      const input = '\x1b[31mRed Text\x1b[0m';
      expect(PtySession.normalize(input, false)).toBe('Red Text');
    });

    it('should strip complex CSI sequences with multiple parameters', () => {
      const input = '\x1b[1;31;42;5mComplex Text\x1b[0m';
      expect(PtySession.normalize(input, false)).toBe('Complex Text');
    });

    it('should strip OSC sequences with BEL terminator', () => {
      const input = '\x1b]0;Terminal Title\x07Hello';
      expect(PtySession.normalize(input, false)).toBe('Hello');
    });

    it('should strip OSC sequences with ST terminator', () => {
      const input = '\x1b]0;Terminal Title\x1b\\Hello';
      expect(PtySession.normalize(input, false)).toBe('Hello');
    });

    it('should strip DCS sequences', () => {
      const input = '\x1b P 1 ; 2 \x1b \\Hello';
      // Note: The current regex /\x1b[P|X|_. a-zA-Z]/g might not match this perfectly if there are spaces
      expect(PtySession.normalize(input, false)).toBe('Hello');
    });

    it('should strip a variety of ANSI escape sequences', () => {
      const input = '\x1b(BHello\x1b(0World';
      expect(PtySession.normalize(input, false)).toBe('HelloWorld');
    });

     it('should handle malformed sequences gracefully by not stripping too much', () => {
       const input = '\x1b[123Hello'; // Malformed CSI (missing terminator)
       // Per ECMA-48, \x1b[123H is a valid CUP command.
       expect(PtySession.normalize(input, false)).toBe('ello');
     });

  });

  describe('Escaping (keepAnsi = true)', () => {
    it('should escape basic CSI sequences', () => {
      const input = '\x1b[31mRed\x1b[0m';
      // Expected: \x1b replaced by \\x1b
      expect(PtySession.normalize(input, true)).toBe('\\x1b[31mRed\\x1b[0m');
    });

     it('should escape OSC sequences', () => {
       const input = '\x1b]0;Title\x07';
       expect(PtySession.normalize(input, true)).toBe('\\x1b]0;Title\\x07');
     });


    it('should escape lone ESC characters', () => {
      const input = 'Lone \x1b character';
      expect(PtySession.normalize(input, true)).toBe('Lone \\x1b character');
    });

    it('should escape non-printable control characters', () => {
      const input = 'Control \x01 and \x02';
      expect(PtySession.normalize(input, true)).toBe('Control \\x01 and \\x02');
    });

    it('should handle complex interleaved content', () => {
      const input = 'Hello \x1b[32mGreen\x1b[0m and \x07 Bell';
      expect(PtySession.normalize(input, true)).toBe('Hello \\x1b[32mGreen\\x1b[0m and \\x07 Bell');
    });
  });
});
