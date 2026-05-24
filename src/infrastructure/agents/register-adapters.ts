import { AgentAdapterFactory } from '../../core/services/agent-adapter-factory.js';
import { ClaudeCodeAdapter } from './claude-code-adapter.js';
import { AiderAdapter } from './aider-adapter.js';
import { OpencodeAdapter } from './opencode-adapter.js';

export function registerAllAdapters(): void {
  AgentAdapterFactory.registerAdapter('claude-code', ClaudeCodeAdapter);
  AgentAdapterFactory.registerAdapter('aider', AiderAdapter);
  AgentAdapterFactory.registerAdapter('opencode', OpencodeAdapter);
}
