import { VteEvent } from './vte-parser';

export class VirtualScreen {
  private rows: string[][];
  private cursorRow: number = 0;
  private cursorCol: number = 0;
  private width: number;
  private height: number;

  constructor(width: number = 80, height: number = 30) {
    this.width = width;
    this.height = height;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
    this.rows = Array.from({ length: height }, () => Array(width).fill(' '));
  }

  public handleEvent(event: VteEvent): void {
    switch (event.type) {
      case 'PutChar':
        this.putChar(event.char);
        break;
      case 'MoveCursorAbsolute':
        this.moveCursorAbsolute(event.row, event.col);
        break;
      case 'MoveCursorRelative':
        this.moveCursorRelative(event.row, event.col);
        break;
      case 'ClearLine':
        this.clearLine(event.mode);
        break;
      case 'ClearScreen':
        this.clearScreen(event.mode);
        break;
    }
  }

  private putChar(char: string): void {
    if (char === '\n') {
      this.cursorRow++;
      this.cursorCol = 0;
    } else if (char === '\r') {
      this.cursorCol = 0;
    } else {
      // Ensure we are within bounds before putting a character
      while (this.cursorRow >= this.height) {
        this.scrollUp();
        this.cursorRow--;
      }
      
      if (this.cursorRow >= 0 && this.cursorRow < this.height) {
        if (this.cursorCol < this.width) {
          this.rows[this.cursorRow][this.cursorCol] = char;
        }
        this.cursorCol++;
      }
    }

    // Handle wrapping
    if (this.cursorCol >= this.width) {
      this.cursorCol = 0;
      this.cursorRow++;
    }

    // Ensure we don't go off bottom (this might happen after \n or wrap)
    // We only scroll if we actually need to put something or move further
    // But for simplicity, let's just keep cursorRow bounded
    if (this.cursorRow >= this.height) {
      // We don't scroll immediately on \n, but we keep track of it
      // and scroll when we actually need to print something.
    }
  }

  private moveCursorAbsolute(row: number, col: number): void {
    // VTE coordinates are usually 1-based
    this.cursorRow = Math.max(0, Math.min(this.height - 1, row - 1));
    this.cursorCol = Math.max(0, Math.min(this.width - 1, col - 1));
  }

  private moveCursorRelative(row: number, col: number): void {
    this.cursorRow = Math.max(0, Math.min(this.height - 1, this.cursorRow + row));
    this.cursorCol = Math.max(0, Math.min(this.width - 1, this.cursorCol + col));
  }

  private clearLine(mode: number): void {
    if (mode === 0) { // Clear from cursor to end of line
      for (let col = this.cursorCol; col < this.width; col++) {
        this.rows[this.cursorRow][col] = ' ';
      }
    } else if (mode === 1) { // Clear from start of line to cursor
      for (let col = 0; col < this.cursorCol; col++) {
        this.rows[this.cursorRow][col] = ' ';
      }
    } else if (mode === 2) { // Clear entire line
      for (let col = 0; col < this.width; col++) {
        this.rows[this.cursorRow][col] = ' ';
      }
    }
  }

  private clearScreen(mode: number): void {
    if (mode === 0 || mode === 2) {
      for (let r = 0; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          this.rows[r][c] = ' ';
        }
      }
      this.cursorRow = 0;
      this.cursorCol = 0;
    } else if (mode === 1) { // Clear from cursor down
      for (let r = this.cursorRow; r < this.height; r++) {
        for (let c = 0; c < this.width; c++) {
          this.rows[r][c] = ' ';
        }
      }
    }
  }

  private scrollUp(): void {
    for (let r = 0; r < this.height - 1; r++) {
      this.rows[r] = [...this.rows[r + 1]];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.rows[this.height - 1] = Array(this.width).fill(' ');
  }

  public getLine(index: number): string {
    if (index < 0 || index >= this.height) return '';
    return this.rows[index].join('');
  }

  public toString(): string {
    return this.rows.map(row => row.join('')).join('\n');
  }

  public contains(text: string): boolean {
    const screenStr = this.toString();
    return screenStr.includes(text);
  }
}
