import { Sandbox } from '../../infrastructure/sandbox';
import { PtySession } from '../../infrastructure/pty-session';
import { AgentAdapterFactory } from './agent-adapter-factory';
import { IPtySession, AgentConfig, IPromptHandler, ISessionOrchestrator } from '../contracts';
import { PromptHandler } from './prompt-handler';

export class SessionOrchestrator implements ISessionOrchestrator {
    async createSession(config: AgentConfig, sandbox: Sandbox): Promise<IPtySession> {
        await sandbox.createSnapshot();
        const adapter = AgentAdapterFactory.createAdapter(config.agentId);
        
        const promptHandler = new PromptHandler();
        const rules = Array.from(adapter.interactionMap).map(([pattern, response]) => ({
            pattern: pattern instanceof RegExp ? pattern.source : pattern,
            response,
        }));
        promptHandler.setRules(rules);

        const session = await PtySession.create(sandbox, adapter, {
            args: config.cliArgs
        }, promptHandler);

        session.onData?.(data => {
            const response = promptHandler.handle(data);
            if (response) {
                session.write(response + '\n');
            }
        });

        return session;
    }

    async executeSession(config: AgentConfig, sandbox: Sandbox, buildCommand: string): Promise<{ success: boolean }> {
        const session = await this.createSession(config, sandbox);
        try {
            await session.waitForExit();
            const success = await this.validateAndRollback(sandbox, buildCommand);
            return { success };
        } finally {
            await session.close();
        }
    }

    async validateAndRollback(sandbox: Sandbox, command: string): Promise<boolean> {
        const result = await sandbox.execute(command);
        if (result.exitCode !== 0) {
            await sandbox.restoreSnapshot();
            return false;
        } else {
            await sandbox.createSnapshot();
            return true;
        }
    }
}
