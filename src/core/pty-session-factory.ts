import type { IPtySessionFactory, ISandbox, IAgentAdapter, IPromptHandler, IPtySession } from './contracts';

export const defaultPtySessionFactory: IPtySessionFactory = {
  async create(sandbox: ISandbox, adapter: IAgentAdapter, options: Record<string, unknown>, promptHandler: IPromptHandler): Promise<IPtySession> {
    const { PtySession } = await import('../infrastructure/pty-session');
    return PtySession.create(sandbox as never, adapter, options, promptHandler);
  },
};
