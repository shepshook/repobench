import { Sandbox } from '../../infrastructure/sandbox';
import { PtySession } from '../../infrastructure/pty-session';
import { AgentAdapterFactory } from './agent-adapter-factory';
import { IPtySession, AgentConfig, ISessionOrchestrator, IDoneDetector, ICostParser, ISessionRepository } from '../contracts';
import { PromptHandler } from './prompt-handler';

export class SessionOrchestrator implements ISessionOrchestrator {
    constructor(
        private doneDetector: IDoneDetector = {
            isDone: () => false,
            setSignatures: () => {},
        },
        private costParser?: ICostParser,
        private sessionRepository?: ISessionRepository
    ) {}

    async createSession(config: AgentConfig, sandbox: Sandbox): Promise<IPtySession> {
        await sandbox.createSnapshot();
        const adapter = AgentAdapterFactory.createAdapter(config);
        adapter.configure(config);
        
        const promptHandler = new PromptHandler();
        const rules = Array.from(adapter.interactionMap).map(([pattern, response]) => ({
            pattern: pattern instanceof RegExp ? pattern.source : pattern,
            response,
        }));
        promptHandler.setRules(rules);

        const session = await PtySession.create(sandbox, adapter, {}, promptHandler);

        if (config.completionSignatures) {
            this.doneDetector.setSignatures(config.completionSignatures);
        }

            session.onData((data) => {
                if (this.doneDetector.isDone(data)) {
                    void session.close().catch(err => {
                        console.error(`Failed to close session on completion: ${err instanceof Error ? err.message : err}`);
                    });
                }
            });

        session.onTimeout(() => {
            void session.close().catch(err => {
                console.error(`Failed to close session on timeout: ${err instanceof Error ? err.message : err}`);
            });
        });

        return session;
    }

    async executeSession(config: AgentConfig, sandbox: Sandbox, buildCommand: string, runId?: string): Promise<{ success: boolean, cost: number }> {
        const session = await this.createSession(config, sandbox);
        let cost = 0;
        try {
            await session.waitForExit();
            
            if (this.costParser) {
                const metrics = this.costParser.parse(session.getScreenState());
                cost = metrics.cost;

                if (this.sessionRepository) {
                    await this.sessionRepository.saveCost(runId!, metrics);
                }
                console.log(`[Cost Summary]${runId ? ` Run: ${runId},` : ''} Total Tokens: ${metrics.totalTokens}, Cost: ${metrics.cost} ${metrics.currency}`);
            }

            const success = await this.validateAndRollback(sandbox, buildCommand);
            return { success, cost };
        } finally {
            try {
                await session.close();
            } catch (err) {
                // Cleanup failure should be logged, but not override the primary exception
                console.error(`Session cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
            }
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
