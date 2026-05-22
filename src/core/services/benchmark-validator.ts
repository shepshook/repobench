import { ISandbox, IBenchmarkValidator, Candidate, ValidationResult } from '../contracts';

export class BenchmarkValidator implements IBenchmarkValidator {
  constructor(
    private readonly sandbox: ISandbox,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly config: any,
  ) {}

  async validate(candidate: Candidate): Promise<ValidationResult> {
    const startTime = Date.now();
    let preFixOutput: string;
    let postFixOutput: string;
    let preFixStatus: ValidationResult['preFixStatus'];
    let postFixStatus: ValidationResult['postFixStatus'];

    try {
      await this.sandbox.switchState(candidate.hash + '^');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const preResult = await this.sandbox.execute(this.config.mining.testCommand, { timeout: 300_000 });
      preFixOutput = preResult.stdout + preResult.stderr;
      preFixStatus = preResult.exitCode === 0 ? 'pass' : 'fail';
    } catch (e) {
      preFixStatus = 'error';
      preFixOutput = e instanceof Error ? e.message : String(e);
    }

    try {
      await this.sandbox.switchState(candidate.hash);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const postResult = await this.sandbox.execute(this.config.mining.testCommand, { timeout: 300_000 });
      postFixOutput = postResult.stdout + postResult.stderr;
      postFixStatus = postResult.exitCode === 0 ? 'pass' : 'fail';
    } catch (e) {
      postFixStatus = 'error';
      postFixOutput = e instanceof Error ? e.message : String(e);
    }

    const isValid = preFixStatus === 'fail' && postFixStatus === 'pass';

    return {
      isValid,
      preFixStatus,
      postFixStatus,
      preFixOutput,
      postFixOutput,
      latency: Math.max(1, Date.now() - startTime),
    };
  }
}
