import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerBenchmarkCommand } from '../../src/cli/benchmark';

describe('CLI: repobench benchmark — command registration', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
  });

  it('should export registerBenchmarkCommand as a function', () => {
    expect(typeof registerBenchmarkCommand).toBe('function');
  });

  it('should register a benchmark subcommand on the program', () => {
    registerBenchmarkCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'benchmark');
    expect(command).toBeDefined();
    expect(command!.name()).toBe('benchmark');
  });

  it('should set the correct description on the benchmark command', () => {
    registerBenchmarkCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'benchmark');
    expect(command!.description()).toBe('Run sandbox initialization benchmark');
  });

  it('should expose -p, --project <name> option with default "default"', () => {
    registerBenchmarkCommand(program);
    const command = program.commands.find(cmd => cmd.name() === 'benchmark');
    const opt = command!.options.find(o => o.long === '--project');
    expect(opt).toBeDefined();
    expect(opt!.short).toBe('-p');
    expect(opt!.attributeName()).toBe('project');
  });

  it('should not interfere with other registered commands', () => {
    program.command('mine').description('Mine candidates');
    registerBenchmarkCommand(program);
    program.command('report').description('Generate report');

    const names = program.commands.map(c => c.name());
    expect(names).toContain('benchmark');
    expect(names).toContain('mine');
    expect(names).toContain('report');
    expect(names.indexOf('benchmark')).toBe(names.indexOf('mine') + 1);
  });
});
