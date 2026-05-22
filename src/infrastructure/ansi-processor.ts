import { VteParser } from './pty/vte-parser';
import { VirtualScreen } from './pty/virtual-screen';

export class AnsiProcessor {
  public static processAnsi(text: string, keepAnsi: boolean): string {
    if (keepAnsi) {
      let finalResult = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = char.charCodeAt(0);
        if (code < 32 && char !== '\n' && char !== '\t' && char !== '\u001b') {
          finalResult += `\\x${code.toString(16).padStart(2, '0')}`;
        } else if (char === '\x1b') {
          finalResult += '\\x1b';
        } else {
          finalResult += char;
        }
      }
      return finalResult;
    }

    const parser = new VteParser();
    const screen = new VirtualScreen();
    const data = new TextEncoder().encode(text);
    const events = parser.parse(data);
    events.forEach(event => screen.handleEvent(event));
    
    return screen.toString().split('\n').map(line => line.trimEnd()).join('\n').trim();
  }

  public static normalize(data: string, keepAnsi: boolean = false): string {
    const processed = data.replace(/\r/g, '');
    
    const lines = processed.split('\n');
    const filteredLines = lines.map(line => {
      let l = line;
      if (!keepAnsi) {
        l = line.replace(/^([^\n\r]*@[^\n\r]*:[^\n\r]*[#$]|[A-Z]:\\[^\n\r]*>|[#$>])\s*/, '');
      }
      
      const strippedL = this.processAnsi(l, false).trim();
      if (strippedL === '') return l;
      
      return l;
    });
    
    const result = filteredLines.join('\n');
    return this.processAnsi(result, keepAnsi).trim();
  }
}
