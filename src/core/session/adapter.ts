import { SessionConfig } from '../../types/contracts';

export abstract class AgentAdapter {
  protected abstract spawnCommand: string;
  protected interactionMap: Map<RegExp, string> = new Map();

  /**
   * Escapes a string for use as a shell argument.
   * Wraps in single quotes and escapes existing single quotes.
   */
  private escapeShellArg(arg: string): string {
    if (!arg) return "''";
    // Replace ' with '"'"' to escape single quotes in a single-quoted string
    return `'${arg.replace(/'/g, () => '"' + "'" + '"')}'`;
  }

  /**
   * Interpolates flags into the spawnCommand.
   * Example: "aider --model {{model}}" -> "aider --model 'gpt-4o'"
   */
  getSpawnCommand(options: Record<string, string | string[]>): string {
    let command = this.spawnCommand;
    for (const [key, value] of Object.entries(options)) {
      const escapedValue = Array.isArray(value) 
        ? value.map(v => this.escapeShellArg(v)).join(' ') 
        : this.escapeShellArg(value);
      
      const regex = new RegExp(`{{${key}}}`, 'g');
      command = command.replace(regex, () => escapedValue);
    }

    if (command.includes('{{') && command.includes('}}')) {
      throw new Error(`Missing required options for spawn command. Remaining placeholders: ${command}`);
    }

    return command;
  }


  /**
   * Returns a predefined response if the input matches a regex in the interaction map.
   */
  getResponse(input: string): string | null {
    for (const [regex, response] of this.interactionMap.entries()) {
      if (regex.test(input)) {
        return response;
      }
    }
    return null;
  }

  /**
   * Allows adding custom interactions to the adapter.
   */
  addInteraction(regex: RegExp, response: string): void {
    this.interactionMap.set(regex, response);
  }
}
