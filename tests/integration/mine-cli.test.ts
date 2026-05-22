import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerMineCommand } from '../../src/cli/mine.js';

describe('CLI: repobench mine — command registration', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
  });

  it('should export registerMineCommand as a function', () => {
    expect(typeof registerMineCommand).toBe('function');
  });

  it('should register a mine subcommand on the program', () => {
    registerMineCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'mine');
    expect(command).toBeDefined();
    expect(command!.name()).toBe('mine');
  });

  it('should set the correct description on the mine command', () => {
    registerMineCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'mine');
    expect(command!.description()).toBe('Mine bug-fix candidates from git history');
  });

  it('should expose -c, --config <path> option with default repobench.yaml', () => {
    registerMineCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'mine');
    const opt = command!.options.find(o => o.long === '--config');
    expect(opt).toBeDefined();
    expect(opt!.short).toBe('-c');
    expect(opt!.attributeName()).toBe('config');
  });

  it('should expose -r, --repo <path> option', () => {
    registerMineCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'mine');
    const opt = command!.options.find(o => o.long === '--repo');
    expect(opt).toBeDefined();
    expect(opt!.short).toBe('-r');
    expect(opt!.attributeName()).toBe('repo');
  });

  it('should not interfere with other registered commands', () => {
    program.command('evaluate').description('Evaluate candidates');
    registerMineCommand(program);
    program.command('report').description('Generate report');

    const names = program.commands.map(c => c.name());
    expect(names).toContain('mine');
    expect(names).toContain('evaluate');
    expect(names).toContain('report');
    expect(names.indexOf('mine')).toBe(names.indexOf('evaluate') + 1);
  });
});
