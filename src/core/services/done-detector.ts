import { IDoneDetector, CompletionSignature } from '../contracts';

export class DoneDetector implements IDoneDetector {
  private signatures: CompletionSignature[] = [];

  setSignatures(signatures: CompletionSignature[]): void {
    this.signatures = signatures;
  }

  isDone(output: string): boolean {
    if (this.signatures.length === 0) {
      return false;
    }

    return this.signatures.some(sig => {
      try {
        const regex = new RegExp(sig.pattern, 'i');
        return regex.test(output);
      } catch (e) {
        // If regex is invalid, treat as plain string match (case-insensitive)
        return output.toLowerCase().includes(sig.pattern.toLowerCase());
      }
    });
  }
}
