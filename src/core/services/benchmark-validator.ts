import { ISandbox, IBenchmarkValidator, Candidate, ValidationResult } from '../contracts';

export class BenchmarkValidator implements IBenchmarkValidator {
  constructor(
    private readonly sandbox: ISandbox,
    private readonly config: any
  ) {}

  async validate(candidate: Candidate): Promise<ValidationResult> {
    const startTime = Date.now();
    let preFixStatus: ValidationResult['preFixStatus'] = 'error';
    let postFixStatus: ValidationResult['postFixStatus'] = 'error';
    let preFixOutput = '';
    let postFixOutput = '';

    try {
      await this.sandbox.switchState(candidate.hash + '^');
      const preResult = await this.sandbox.execute(this.config.mining.testCommand);
      preFixOutput = preResult.stdout + preResult.stderr;
      preFixStatus = preResult.exitCode === 0 ? 'pass' : 'fail';
    } catch (e) {
      preFixStatus = 'error';
      preFixOutput = e instanceof Error ? e.message : String(e);
    }

    try {
      await this.sandbox.switchState(candidate.hash);
      const postResult = await this.sandbox.execute(this.config.mining.testCommand);
      postFixOutput = postResult.stdout + postResult.stderr;
      postFixStatus = postResult.exitCode === 0 ? 'pass' : 'fail';
    } catch (e) {
      postFixStatus = 'error';
      postFixOutput = e instanceof Error ? e.message : String(e);
    }

    const endTime = Date.now();

    return {
      isValid: preFixStatus === 'fail' && postFixStatus === 'pass',
      preFixStatus,
      postFixStatus,
      preFixOutput,
      postFixOutput,
      latency: endTime - startTime,
    };
  }
}
