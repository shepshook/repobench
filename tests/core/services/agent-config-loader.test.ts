import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentConfigLoader } from '../../../src/core/services/agent-config-loader';
import { AgentConfig } from '../../../src/core/contracts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('AgentConfigLoader', () => {
    let tempDir: string;
    let configPath: string;
    let loader: AgentConfigLoader;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repobench-test-'));
        configPath = path.join(tempDir, 'agents.yaml');
        loader = new AgentConfigLoader(configPath);
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should successfully load and parse a valid agents.yaml', () => {
        const validYaml = `
- agentId: 'claude-3-5-sonnet'
  model: 'claude-3-5-sonnet-20240620'
  temperature: 0.5
  systemPrompt: 'You are a helpful assistant'
  max_tokens: 4096
  cliArgs: ['--verbose']
  completionSignatures:
    - pattern: 'DONE'
      name: 'completion'

- agentId: 'gpt-4o'
  model: 'gpt-4o'
  temperature: 0.7
  systemPrompt: 'You are a coding expert'
  cliArgs: []
`;
        fs.writeFileSync(configPath, validYaml);

        const configs = loader.loadConfigs();
        
        expect(configs).toHaveLength(2);
        expect(configs[0]).toMatchObject({
            agentId: 'claude-3-5-sonnet',
            model: 'claude-3-5-sonnet-20240620',
            temperature: 0.5,
        });
        expect(configs[1].agentId).toBe('gpt-4o');
    });

    it('should throw a validation error when agents.yaml contains invalid data', () => {
        const invalidYaml = `
- agentId: 'invalid-agent'
  model: 'some-model'
  temperature: 5.0 # Should be max 2.0
  systemPrompt: 'Missing cliArgs'
`;
        fs.writeFileSync(configPath, invalidYaml);

        expect(() => loader.loadConfigs()).toThrow(/Invalid AgentConfig/);
    });

    it('should throw an error if agents.yaml is missing', () => {
        // configPath exists but file is not written
        expect(() => loader.loadConfigs()).toThrow(/Could not find agents.yaml/);
    });

    it('should return an empty array when agents.yaml is empty', () => {
        fs.writeFileSync(configPath, '');

        const configs = loader.loadConfigs();
        expect(configs).toEqual([]);
    });

    it('should throw an error if agents.yaml is not a valid YAML file', () => {
        fs.writeFileSync(configPath, 'this is not yaml : { [');

        try {
            loader.loadConfigs();
            expect.fail('Should have thrown an error');
        } catch (e: any) {
            expect(e).toBeInstanceOf(Error);
            expect(e.cause).toBeDefined();
        }
    });
});
