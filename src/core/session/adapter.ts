import { SessionConfig } from '../../types/contracts';

export interface SpawnConfig {
  shell: string;
  args: string[];
}

export abstract class AgentAdapter {
  protected abstract shell: string;
  protected abstract getArgs(options: Record<string, string | string[]>): string[];
  protected interactionMap: Map<RegExp, string> = new Map();

  /**
   * Expands a value (string or array of strings) into an array of arguments.
   */
  protected expandArgs(args: string | string[] | undefined): string[] {
    if (!args) return [];
    return Array.isArray(args) ? args : [args];
  }

  /**
   * Resolves the shell and arguments for spawning the agent.
   */
  getSpawnConfig(options: Record<string, string | string[]>): SpawnConfig {
    return {
      shell: this.shell,
      args: this.getArgs(options)
    };
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
