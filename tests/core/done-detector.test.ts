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
});
