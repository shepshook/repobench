import { AgentAdapter } from '../adapter';

export class AiderAdapter extends AgentAdapter {
  protected spawnCommand = 'aider {{model}} {{flags}}';

  protected interactionMap = new Map<RegExp, string>([
    [/^\s*Do you want to apply these changes\? \[y\/n\].*$/i, 'y'],
    [/^\s*Enter your OpenAI API key:.*$/i, process.env.OPENAI_API_KEY || ''],
    [/^\s*Confirm to start\? \[y\/n\].*$/i, 'y'],
  ]);
}
