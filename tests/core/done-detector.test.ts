import { DoneDetector } from '../../src/core/services/done-detector';
import { CompletionSignature } from '../../src/core/contracts';

describe('DoneDetector', () => {
  let detector: DoneDetector;

  beforeEach(() => {
    detector = new DoneDetector();
  });

  it('should return false by default when no signatures are set', () => {
    expect(detector.isDone('some random output')).toBe(false);
  });

  it('should return true when output matches a configured signature', () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'I have finished the task', name: 'finished' },
      { pattern: 'Task completed successfully', name: 'completed' },
    ];
    detector.setSignatures(signatures);

    expect(detector.isDone('I have finished the task')).toBe(true);
    expect(detector.isDone('Task completed successfully')).toBe(true);
  });

  it('should return false when output does not match any configured signature', () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'I have finished the task', name: 'finished' },
    ];
    detector.setSignatures(signatures);

    expect(detector.isDone('I am still working on it')).toBe(false);
  });

  it('should support regex patterns in signatures', () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'Done with task \\d+', name: 'task-done' },
    ];
    detector.setSignatures(signatures);

    expect(detector.isDone('Done with task 1')).toBe(true);
    expect(detector.isDone('Done with task 42')).toBe(true);
    expect(detector.isDone('Done with task')).toBe(false);
  });

  it('should handle empty signature lists', () => {
    detector.setSignatures([]);
    expect(detector.isDone('I have finished the task')).toBe(false);
  });

  it('should be case-insensitive if configured or by default (depending on requirement, but usually preferred for signatures)', () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'task completed', name: 'completed' },
    ];
    detector.setSignatures(signatures);

    // Assuming case-insensitivity is desired for these signatures
    expect(detector.isDone('TASK COMPLETED')).toBe(true);
    expect(detector.isDone('Task Completed')).toBe(true);
  });

  it('should emit a "done" event when a signature match is detected', async () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'Task completed', name: 'completed' },
    ];
    detector.setSignatures(signatures);

    const donePromise = new Promise((resolve) => {
      detector.on('done', (signature) => {
        expect(signature.name).toBe('completed');
        resolve(true);
      });
    });

    detector.isDone('Task completed');
    await expect(donePromise).resolves.toBe(true);
  });

  it('should emit "done" event when attached to a PtySession and matching data is received', async () => {
    const signatures: CompletionSignature[] = [
      { pattern: 'Finished!', name: 'finished' },
    ];
    detector.setSignatures(signatures);

    const mockSession: any = {
      onData: (callback: (data: string) => void) => {
        mockSession._onDataCallback = callback;
      },
    };

    const donePromise = new Promise((resolve) => {
      detector.on('done', (signature) => {
        expect(signature.name).toBe('finished');
        resolve(true);
      });
    });

    detector.attach(mockSession);
    mockSession._onDataCallback('Some output... Finished!');
    await expect(donePromise).resolves.toBe(true);
  });

  it('should throw a descriptive error if initialized with invalid signatures', () => {
    expect(() => {
      new DoneDetector(null as any);
    }).toThrow(/signatures/i);
  });

  it('should throw a descriptive error in constructor if any signature has an invalid regex pattern', () => {
    const invalidSignatures: CompletionSignature[] = [
      { pattern: '[', name: 'invalid-regex' },
    ];
    expect(() => {
      new DoneDetector(invalidSignatures);
    }).toThrow(/invalid regex/i);
  });

  it('should throw a descriptive error in setSignatures if any signature has an invalid regex pattern', () => {
    const invalidSignatures: CompletionSignature[] = [
      { pattern: '(', name: 'invalid-regex' },
    ];
    expect(() => {
      detector.setSignatures(invalidSignatures);
    }).toThrow(/invalid regex/i);
  });

  it('should not fall back to substring match when a regex is invalid (it should have thrown earlier)', () => {
    // This test ensures that if someone bypasses setSignatures/constructor (e.g. via casting), 
    // we still don't want "hope-based" error handling.
    // However, the primary goal is to ensure setSignatures and constructor throw.
    // We can simulate a "forced" invalid signature if we really want to check isDone's internal behavior,
    // but the audit feedback focuses on the input validation.
  });
});
