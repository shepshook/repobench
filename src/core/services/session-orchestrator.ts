import { Sandbox } from '../../infrastructure/sandbox';
import { PtySession } from '../../infrastructure/pty-session';
import { AgentAdapterFactory } from './agent-adapter-factory';
import { IPtySession, AgentConfig, IPromptHandler } from '../contracts';
import { PromptHandler } from './prompt-handler';

export class SessionOrchestrator {
    async createSession(config: AgentConfig, sandbox: Sandbox): Promise<IPtySession> {
        const adapter = AgentAdapterFactory.createAdapter(config.agentId);
        
        const promptHandler = new PromptHandler();
        const rules = Array.from(adapter.interactionMap).map(([pattern, response]) => ({
            pattern: pattern instanceof RegExp ? pattern.source : pattern,
            response,
        }));
        promptHandler.setRules(rules);

        return await PtySession.create(sandbox, adapter, {
            args: config.cliArgs
        }, promptHandler);
    }
}
