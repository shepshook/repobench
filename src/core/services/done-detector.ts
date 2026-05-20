import { EventEmitter } from 'events';
import { IDoneDetector, CompletionSignature, IPtySession } from '../contracts';

export class DoneDetector extends EventEmitter implements IDoneDetector {
  private compiledSignatures: { regex: RegExp; signature: CompletionSignature }[] = [];

  constructor(signatures?: CompletionSignature[]) {
    super();
    if (signatures === null) {
      throw new Error('Invalid signatures: cannot be null');
    }
    if (signatures) {
      this.setSignatures(signatures);
    }
  }

  setSignatures(signatures: CompletionSignature[]): void {
    this.compiledSignatures = this.validateAndCompile(signatures);
  }

  private validateAndCompile(signatures: CompletionSignature[]) {
    return signatures.map((sig) => {
      try {
        return {
          regex: new RegExp(sig.pattern, 'i'),
          signature: sig,
        };
      } catch (e) {
        throw new Error(
          `Invalid regex pattern in completion signature "${sig.name}": ${sig.pattern}. ${
            e instanceof Error ? e.message : e
          }`
        );
      }
    });
  }

  isDone(output: string): boolean {
    if (this.compiledSignatures.length === 0) {
      return false;
    }

    for (const { regex, signature } of this.compiledSignatures) {
      if (regex.test(output)) {
        this.emit('done', signature);
        return true;
      }
    }
    return false;
  }

  attach(session: IPtySession): void {

    session.onData((data) => {
      this.isDone(data);
    });
  }
}
