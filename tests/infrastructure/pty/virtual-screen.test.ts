import { VirtualScreen } from '../../../src/infrastructure/pty/virtual-screen';
import { VteEvent } from '../../../src/infrastructure/pty/vte-parser';

describe('VirtualScreen', () => {
  let screen: VirtualScreen;

  beforeEach(() => {
    screen = new VirtualScreen(10, 5); // Small screen for easy testing
  });

  it('should put characters on the screen', () => {
    screen.handleEvent({ type: 'PutChar', char: 'H' });
    screen.handleEvent({ type: 'PutChar', char: 'i' });
    expect(screen.getLine(0)).toBe('Hi        ');
  });

  it('should handle newlines', () => {
    screen.handleEvent({ type: 'PutChar', char: 'A' });
    screen.handleEvent({ type: 'PutChar', char: '\n' });
    screen.handleEvent({ type: 'PutChar', char: 'B' });
    expect(screen.getLine(0)).toBe('A         ');
    expect(screen.getLine(1)).toBe('B         ');
  });

  it('should handle cursor movement', () => {
    screen.handleEvent({ type: 'MoveCursorAbsolute', row: 2, col: 3 });
    screen.handleEvent({ type: 'PutChar', char: 'X' });
    expect(screen.getLine(1)).toBe('  X       ');
  });

  it('should handle relative cursor movement', () => {
    screen.handleEvent({ type: 'PutChar', char: 'A' });
    screen.handleEvent({ type: 'MoveCursorRelative', row: 1, col: 1 });
    screen.handleEvent({ type: 'PutChar', char: 'B' });
    expect(screen.getLine(0)).toBe('A         ');
    expect(screen.getLine(1)).toBe('  B       ');
  });

  it('should handle line clearing', () => {
    screen.handleEvent({ type: 'PutChar', char: 'A' });
    screen.handleEvent({ type: 'PutChar', char: 'B' });
    screen.handleEvent({ type: 'PutChar', char: 'C' });
    screen.handleEvent({ type: 'MoveCursorRelative', row: 0, col: -1 }); // Back to 'B'
    screen.handleEvent({ type: 'ClearLine', mode: 0 }); // Clear to end
    expect(screen.getLine(0)).toBe('AB        ');
  });

  it('should handle screen clearing', () => {
    screen.handleEvent({ type: 'PutChar', char: 'A' });
    screen.handleEvent({ type: 'ClearScreen', mode: 2 });
    const expected = Array(5).fill(' '.repeat(10)).join('\n');
    expect(screen.toString()).toBe(expected);
  });

  it('should handle wrapping', () => {
    for (let i = 0; i < 11; i++) {
      screen.handleEvent({ type: 'PutChar', char: 'X' });
    }
    expect(screen.getLine(0)).toBe('XXXXXXXXXX');
    expect(screen.getLine(1)).toBe('X         ');
  });

  it('should handle scrolling', () => {
    for (let i = 0; i < 6; i++) {
      screen.handleEvent({ type: 'PutChar', char: 'L' });
      screen.handleEvent({ type: 'PutChar', char: '\n' });
    }
    // Screen height is 5. Line 0 should be gone.
    expect(screen.getLine(0)).toBe('L         ');
    expect(screen.getLine(4)).toBe('L         ');
  });

  it('should contain text', () => {
    screen.handleEvent({ type: 'PutChar', char: 'H' });
    screen.handleEvent({ type: 'PutChar', char: 'i' });
    expect(screen.contains('Hi')).toBe(true);
    expect(screen.contains('No')).toBe(false);
  });
});
