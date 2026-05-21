import fs from 'node:fs';
import YAML from 'yaml';
import { AgentConfig, AgentConfigSchema } from '../contracts';

export class AgentConfigLoader {
    constructor(private readonly configPath: string) {}

    loadConfigs(): AgentConfig[] {
        if (!fs.existsSync(this.configPath)) {
            throw new Error(`Could not find agents.yaml at ${this.configPath}`);
        }

        const fileContent = fs.readFileSync(this.configPath, 'utf8');
        if (!fileContent.trim()) {
            return [];
        }

        let parsed: unknown;
        try {
            parsed = YAML.parse(fileContent);
        } catch (e) {
            throw new Error(`Failed to parse agents.yaml: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
        }

        if (!Array.isArray(parsed)) {
            throw new Error('agents.yaml must contain a list of agent configurations');
        }

        return parsed.map((config, index) => {
            const result = AgentConfigSchema.safeParse(config);
            if (!result.success) {
                const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                throw new Error(`Invalid AgentConfig at index ${index}: ${issues}`);
            }
            return result.data;
        });
    }
}
