export type VteEvent =
  | { type: 'PutChar'; char: string }
  | { type: 'MoveCursorAbsolute'; row: number; col: number }
  | { type: 'MoveCursorRelative'; row: number; col: number }
  | { type: 'ClearLine'; mode: number }
  | { type: 'ClearScreen'; mode: number }
  | { type: 'ScrollUp' }
  | { type: 'ScrollDown' }
  | { type: 'SetTabStop'; width: number };

export enum VteState {
  GROUND,
  ESCAPE,
  CSI,
  OSC,
  DCS,
  CHARSET,
  S_ESCAPE,
}

export class VteParser {
  private state: VteState = VteState.GROUND;
  private csiParams: number[] = [];
  private csiIntermediate: string[] = [];
  private lastByte: number = 0;

  public parse(data: Uint8Array): VteEvent[] {
    const events: VteEvent[] = [];

    for (let i = 0; i < data.length; i++) {
      const byte = data[i];

      switch (this.state) {
        case VteState.GROUND:
          if (byte === 0x1b) {
            this.state = VteState.ESCAPE;
          } else {
            events.push({ type: 'PutChar', char: String.fromCharCode(byte) });
          }
          break;

        case VteState.ESCAPE:
          if (byte === 0x20) { // Space
            // Allow optional whitespace before the DCS/OSC/CSI identifiers
            break;
          } else if (byte === 0x40) { // @
            this.state = VteState.GROUND;
          } else if (byte === 0x5b) { // [
            this.state = VteState.CSI;
            this.csiParams = [];
            this.csiIntermediate = [];
          } else if (byte === 0x5d) { // ]
            this.state = VteState.OSC;
          } else if (byte === 0x50) { // P
            this.state = VteState.DCS;
          } else if (byte === 0x28 || byte === 0x29) { // ( or )
            this.state = VteState.CHARSET;
          } else {
            this.state = VteState.GROUND;
            events.push({ type: 'PutChar', char: String.fromCharCode(byte) });
          }
          break;

        case VteState.CHARSET:
          this.state = VteState.GROUND;
          break;

        case VteState.CSI:
          if (byte >= 0x30 && byte <= 0x39) { // '0'-'9'
            if (this.csiParams.length > 0 && this.lastByte >= 0x30 && this.lastByte <= 0x39) {
              const last = this.csiParams.pop()!;
              this.csiParams.push(last * 10 + (byte - 0x30));
            } else {
              this.csiParams.push(byte - 0x30);
            }
          } else if (byte >= 0x20 && byte <= 0x3f) { // Space to ?
            this.csiIntermediate.push(String.fromCharCode(byte));
          } else if (byte >= 0x40 && byte <= 0x7e) { // @ to ~
            const event = this.handleCsi(byte);
            if (event) events.push(event);
            this.state = VteState.GROUND;
            this.csiParams = [];
            this.csiIntermediate = [];
          } else {
            this.state = VteState.GROUND;
            this.csiParams = [];
            this.csiIntermediate = [];
          }
          break;

        case VteState.OSC:
          if (byte === 0x07) { // BEL
            this.state = VteState.GROUND;
          } else if (byte === 0x1b) { // ESC
            this.state = VteState.S_ESCAPE;
          }
          break;

        case VteState.DCS:
          if (byte === 0x1b) { // ESC
            this.state = VteState.S_ESCAPE;
          }
          break;

        case VteState.S_ESCAPE:
          if (byte === 0x5c) { // \
            this.state = VteState.GROUND;
          } else if (byte === 0x20) { // Space
            // Allow optional whitespace before the \ terminator
            break;
          } else {
            this.state = VteState.ESCAPE;
            events.push({ type: 'PutChar', char: String.fromCharCode(byte) });
          }
          break;
      }
      this.lastByte = byte;
    }

    return events;
  }

  private handleCsi(terminator: number): VteEvent | null {
    const char = String.fromCharCode(terminator);
    const params = this.csiParams;

    if (char === 'A') { // Cursor Up
      return { type: 'MoveCursorRelative', row: -(params[0] || 1), col: 0 };
    }
    if (char === 'B') { // Cursor Down
      return { type: 'MoveCursorRelative', row: params[0] || 1, col: 0 };
    }
    if (char === 'C') { // Cursor Forward
      return { type: 'MoveCursorRelative', row: 0, col: params[0] || 1 };
    }
    if (char === 'D') { // Cursor Backward
      return { type: 'MoveCursorRelative', row: 0, col: -(params[0] || 1) };
    }
    if (char === 'H' || char === 'f') { // Cursor Position
      return { type: 'MoveCursorAbsolute', row: params[0] || 1, col: params[1] || 1 };
    }
    if (char === 'J') { // Erase in Display
      return { type: 'ClearScreen', mode: params[0] || 0 };
    }
    if (char === 'K') { // Erase in Line
      return { type: 'ClearLine', mode: params[0] || 0 };
    }

    return null;
  }
}
