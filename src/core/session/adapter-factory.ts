import { AgentAdapter } from './adapter';
import { AiderAdapter } from './adapters/aider';
import { ClaudeCodeAdapter } from './adapters/claude-code';

export class AdapterFactory {
  private static readonly registry: Record<string, new () => AgentAdapter> = {
    aider: AiderAdapter,
    claude: ClaudeCodeAdapter,
  };

  static getAdapter(agentName: string): AgentAdapter {
    if (!agentName) {
      throw new Error('Agent name is required');
    }
    const AdapterClass = this.registry[agentName.toLowerCase()];
    if (!AdapterClass) {
      throw new Error(`Unknown agent name: ${agentName}. Supported agents are: ${Object.keys(this.registry).join(', ')}`);
    }
    return new AdapterClass();
  }
}
