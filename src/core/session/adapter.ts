export abstract class AgentAdapter {
  protected abstract spawnCommand: string;
  protected abstract interactionMap: Map<RegExp, string>;

  public getSpawnCommand(options: Record<string, string>): string {
    let command = this.spawnCommand;
    for (const [key, value] of Object.entries(options)) {
      command = command.replace(`{{${key}}}`, value);
    }
    return command;
  }

  public getResponse(input: string): string | null {
    for (const [regex, response] of this.interactionMap.entries()) {
      if (regex.test(input)) {
        return response;
      }
    }
    return null;
  }
}
