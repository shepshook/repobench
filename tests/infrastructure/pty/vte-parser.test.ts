import { VteParser, VteEvent } from '../../../src/infrastructure/pty/vte-parser';

describe('VteParser', () => {
  let parser: VteParser;

  beforeEach(() => {
    parser = new VteParser();
  });

  const toUint8 = (str: string) => new TextEncoder().encode(str);

  it('should parse plain text', () => {
    const input = toUint8('Hello World');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'PutChar', char: 'H' },
      { type: 'PutChar', char: 'e' },
      { type: 'PutChar', char: 'l' },
      { type: 'PutChar', char: 'l' },
      { type: 'PutChar', char: 'o' },
      { type: 'PutChar', char: ' ' },
      { type: 'PutChar', char: 'W' },
      { type: 'PutChar', char: 'o' },
      { type: 'PutChar', char: 'r' },
      { type: 'PutChar', char: 'l' },
      { type: 'PutChar', char: 'd' },
    ]);
  });

  it('should handle cursor movement (relative)', () => {
    const input = toUint8('\x1b[1A\x1b[2B\x1b[3C\x1b[4D');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'MoveCursorRelative', row: -1, col: 0 },
      { type: 'MoveCursorRelative', row: 2, col: 0 },
      { type: 'MoveCursorRelative', row: 0, col: 3 },
      { type: 'MoveCursorRelative', row: 0, col: -4 },
    ]);
  });

  it('should handle cursor position (absolute)', () => {
    const input = toUint8('\x1b[10;20H');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'MoveCursorAbsolute', row: 10, col: 20 },
    ]);
  });

  it('should handle clearing', () => {
    const input = toUint8('\x1b[2J\x1b[0K');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'ClearScreen', mode: 2 },
      { type: 'ClearLine', mode: 0 },
    ]);
  });

  it('should handle OSC sequences', () => {
    const input = toUint8('\x1b]0;Title\x07Hello');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'PutChar', char: 'H' },
      { type: 'PutChar', char: 'e' },
      { type: 'PutChar', char: 'l' },
      { type: 'PutChar', char: 'l' },
      { type: 'PutChar', char: 'o' },
    ]);
  });

  it('should handle multi-digit parameters', () => {
    const input = toUint8('\x1b[12A');
    const events = parser.parse(input);
    expect(events).toEqual([
      { type: 'MoveCursorRelative', row: -12, col: 0 },
    ]);
  });

  it('should maintain state across parse calls', () => {
    const input1 = toUint8('\x1b[');
    const input2 = toUint8('10A');
    const events1 = parser.parse(input1);
    const events2 = parser.parse(input2);
    expect(events1).toEqual([]);
    expect(events2).toEqual([
      { type: 'MoveCursorRelative', row: -10, col: 0 },
    ]);
  });
});
